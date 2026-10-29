import { CATEGORIES, DEMO_HEALTH_ID } from "./constants";
import { blindIndex, randomRef, sha256 } from "./crypto";
import {
  Organization, Person, User, Record, ConsentRequest, Grant, AccessLog, ConsentEvent,
  DataKey, VaultObject, BreakGlass, Notification,
} from "./models";
import { sealPayload } from "./vault";
import { logAccess, logConsentEvent } from "./chain";

const DAY = 24 * 3600 * 1000;

// Rebuilds the scenario from section 6 of the report: Anita Das, BGH, Northeast Lab, Aegis Insurance.
export async function seedDemo() {
  // Clear with the raw driver (bypasses the append-only guards). Avoids dropDatabase, which needs admin rights on Atlas.
  const models = [Organization, Person, User, Record, ConsentRequest, Grant, AccessLog, ConsentEvent, DataKey, VaultObject, BreakGlass, Notification];
  await Promise.all(models.map((m) => m.collection.deleteMany({})));
  await Promise.all(models.map((m) => m.init()));

  const [bgh, lab, aegis] = await Organization.create([
    {
      code: "O1", name: "Brahmaputra General Hospital", orgType: "hospital", registrationNumber: "AS-HOSP-00417",
      jurisdiction: "IN-AS", verification: "verified", permittedCategories: CATEGORIES,
      permittedPurposes: ["treatment", "emergency", "research"],
    },
    {
      code: "O2", name: "Northeast Diagnostics Lab", orgType: "diagnostic_lab", registrationNumber: "AS-LAB-01192",
      jurisdiction: "IN-AS", verification: "verified", permittedCategories: ["lab_result", "imaging_study"],
      permittedPurposes: ["treatment"],
    },
    {
      code: "O3", name: "Aegis Health Insurance", orgType: "insurer", registrationNumber: "IRDAI-158",
      jurisdiction: "IN", verification: "verified",
      permittedCategories: ["discharge_summary", "lab_result", "diagnosis", "procedure", "insurance_claim"],
      permittedPurposes: ["claims_adjudication"],
    },
  ]);

  const anita = await Person.create({
    publicRef: randomRef(),
    dataResidencyRegion: "ap-south-1",
    primaryIdBlindIndex: blindIndex(DEMO_HEALTH_ID),
  });

  const [, rahul, kabir, priya] = await User.create([
    { code: "U1", name: "Anita Das", email: "anita.das@example.com", kind: "patient", personId: anita._id },
    { code: "U2", name: "Dr. Rahul Sharma", email: "rahul.sharma@bgh.example", kind: "clinician", orgId: bgh._id, role: "attending_physician", licence: "AMC-22871" },
    { code: "U3", name: "Kabir Deka", email: "kabir.deka@nedl.example", kind: "clinician", orgId: lab._id, role: "lab_scientist", licence: "AS-MLT-5531" },
    { code: "U4", name: "Priya Nair", email: "priya.nair@aegis.example", kind: "insurer", orgId: aegis._id, role: "claims_adjuster" },
  ]);

  const encounter = "E1 · inpatient · BGH · 12–15 Aug 2026";
  const records = [
    {
      category: "lab_result", sensitivity: "normal", author: lab, authorUser: kabir, encounter,
      code: ["LOINC", "718-7", "Hemoglobin [Mass/volume] in Blood"], effectiveAt: "2026-08-12",
      payload: { result: "Hemoglobin 11.2 g/dL (reference 12.0–15.5)", note: "Mild anaemia, likely related to infection." },
    },
    {
      category: "discharge_summary", sensitivity: "normal", author: bgh, authorUser: rahul, encounter,
      code: ["SNOMED-CT", "373942005", "Discharge summary"], effectiveAt: "2026-08-15",
      payload: {
        summary: "Admitted 12 Aug with community-acquired pneumonia. Treated with IV antibiotics; discharged stable on 15 Aug.",
        followUp: "Review in outpatient clinic after 2 weeks.",
      },
    },
    {
      category: "mental_health", sensitivity: "sensitive", author: bgh, authorUser: rahul, encounter: null,
      code: [null, null, null], effectiveAt: "2026-06-02",
      payload: { note: "Counselling session: generalised anxiety. CBT plan agreed, follow-up in 4 weeks." },
    },
    {
      category: "prescription", sensitivity: "normal", author: bgh, authorUser: rahul, encounter,
      code: ["RxNorm", "562508", "Amoxicillin / Clavulanate 625 mg"], effectiveAt: "2026-08-15",
      payload: { medication: "Amoxicillin-clavulanate 625 mg", dosage: "1 tablet three times a day for 5 days" },
    },
  ];

  const created = [];
  for (const r of records) {
    const vault = await sealPayload(anita._id, r.payload);
    created.push(
      await Record.create({
        personId: anita._id, encounter: r.encounter, category: r.category, sensitivity: r.sensitivity,
        authorOrgId: r.author._id, authorUserId: r.authorUser._id,
        codeSystem: r.code[0], codeValue: r.code[1], codeDisplay: r.code[2],
        payloadVaultObjectId: vault._id, effectiveAt: new Date(r.effectiveAt),
        contentDigest: vault.plaintextSha256,
      })
    );
  }
  const [r1, r2, r3] = created;

  // Q1 -> G1: Aegis asked for labs + discharge summary; Anita approved but excluded mental health.
  const now = Date.now();
  const q1 = await ConsentRequest.create({
    personId: anita._id, requesterOrgId: aegis._id, requesterUserId: priya._id, purpose: "claims_adjudication",
    justification: "Verify hospitalisation for claim CLM-77120 (12–15 Aug 2026).",
    requestedCategories: ["lab_result", "discharge_summary"], durationDays: 90, status: "approved",
    createdAt: new Date(now - 8 * DAY), decidedAt: new Date(now - 7 * DAY),
  });
  const scopes = [
    { category: "lab_result", from: new Date("2026-08-01"), to: new Date("2026-08-31T23:59:59Z") },
    { category: "discharge_summary", authorOrgId: bgh._id },
    { category: "mental_health", isExclusion: true },
  ];
  const g1 = await Grant.create({
    personId: anita._id, requestId: q1._id, granteeOrgId: aegis._id, purpose: "claims_adjudication",
    actions: ["read"], validFrom: new Date(now - 7 * DAY), validUntil: new Date(now + 83 * DAY),
    maxUses: 5, useCount: 1, scopes, subjectAuthAal: 2,
    subjectSignature: sha256(JSON.stringify({ request: q1._id, scopes })),
    createdAt: new Date(now - 7 * DAY),
  });
  await ConsentRequest.collection.updateOne({ _id: q1._id }, { $set: { grantId: g1._id } });

  await logConsentEvent({ personId: anita._id, kind: "requested", requestId: q1._id, actorUserId: priya._id, payload: { org: aegis.name }, createdAt: new Date(now - 8 * DAY) });
  await logConsentEvent({ personId: anita._id, kind: "granted", requestId: q1._id, grantId: g1._id, actorUserId: anita._id, payload: { excluded: ["mental_health"] }, createdAt: new Date(now - 7 * DAY) });

  // The adjuster's first read: R1 and R2 allowed, R3 denied by the exclusion scope.
  const base = { personId: anita._id, actorUserId: priya._id, actorOrgId: aegis._id, action: "read", purpose: "claims_adjudication" };
  const t = now - 6 * DAY;
  await logAccess({ ...base, recordId: r1._id, category: r1.category, decision: "allow", grantId: g1._id, createdAt: new Date(t) });
  await logAccess({ ...base, recordId: r2._id, category: r2.category, decision: "allow", grantId: g1._id, createdAt: new Date(t + 1) });
  await logAccess({ ...base, recordId: r3._id, category: r3.category, decision: "deny", denyReason: "scope_exclusion:mental_health", createdAt: new Date(t + 2) });

  // A pending request from the hospital so the patient's consent inbox has something to decide.
  const q2 = await ConsentRequest.create({
    personId: anita._id, requesterOrgId: bgh._id, requesterUserId: rahul._id, purpose: "treatment",
    justification: "Post-discharge follow-up for pneumonia; need recent labs, prescriptions and discharge notes.",
    requestedCategories: ["lab_result", "prescription", "discharge_summary", "diagnosis"], durationDays: 30,
    createdAt: new Date(now - DAY),
  });
  await logConsentEvent({ personId: anita._id, kind: "requested", requestId: q2._id, actorUserId: rahul._id, payload: { org: bgh.name }, createdAt: new Date(now - DAY) });

  await Notification.create([
    { personId: anita._id, kind: "access", message: "Aegis Health Insurance read 2 records; 1 attempt was denied.", createdAt: new Date(t) },
    { personId: anita._id, kind: "request", message: "Brahmaputra General Hospital requested access for treatment.", createdAt: new Date(now - DAY) },
  ]);

  return { publicRef: anita.publicRef };
}
