import mongoose, { Schema } from "mongoose";
import { CATEGORIES, PURPOSES, SENSITIVITY } from "./constants";

const { ObjectId } = Schema.Types;
const model = (name, schema, collection) => mongoose.models[name] || mongoose.model(name, schema, collection);

// Rejects every update/delete issued through Mongoose (the equivalent of the append_only() trigger).
function appendOnly(schema, label) {
  const reject = function () {
    throw new Error(`${label} is append-only: updates and deletes are rejected`);
  };
  for (const op of [
    "updateOne",
    "updateMany",
    "findOneAndUpdate",
    "replaceOne",
    "findOneAndReplace",
    "deleteOne",
    "deleteMany",
    "findOneAndDelete",
  ]) {
    schema.pre(op, reject);
  }
  schema.pre("save", function () {
    if (!this.isNew) reject();
  });
}

// ---------- identity ----------

const organizationSchema = new Schema({
  code: { type: String, unique: true },
  name: String,
  orgType: { type: String, enum: ["hospital", "diagnostic_lab", "pharmacy", "insurer", "tpa"] },
  registrationNumber: { type: String, unique: true },
  jurisdiction: String,
  verification: { type: String, enum: ["pending", "verified", "suspended"], default: "pending" },
  permittedCategories: [{ type: String, enum: CATEGORIES }],
  permittedPurposes: [{ type: String, enum: PURPOSES }],
});

// The data subject. Deliberately holds no name, DOB or address.
const personSchema = new Schema({
  publicRef: { type: String, unique: true },
  dataResidencyRegion: String,
  primaryIdBlindIndex: { type: String, unique: true },
  status: { type: String, enum: ["active", "deceased", "erased"], default: "active" },
  legalHold: { type: Boolean, default: false },
});

const userSchema = new Schema({
  code: { type: String, unique: true },
  name: String,
  email: { type: String, unique: true, lowercase: true },
  kind: { type: String, enum: ["patient", "clinician", "insurer"] },
  personId: { type: ObjectId, ref: "Person" },
  orgId: { type: ObjectId, ref: "Organization" },
  role: String,
  licence: String,
});

// ---------- vault ----------

const dataKeySchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  kekId: String,
  generation: Number,
  wrapped: { ciphertext: String, nonce: String, authTag: String },
  state: { type: String, enum: ["active", "shredded"], default: "active" },
  shreddedAt: Date,
});

const vaultObjectSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  dataKeyId: { type: ObjectId, ref: "DataKey" },
  storageLocator: String,
  cipher: { type: String, default: "AES-256-GCM" },
  ciphertext: String,
  nonce: String,
  authTag: String,
  aadDigest: String,
  plaintextSha256: String,
  byteSize: Number,
  shreddedAt: Date,
});

// ---------- clinical ----------

const recordSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  encounter: String,
  category: { type: String, enum: CATEGORIES, required: true },
  sensitivity: { type: String, enum: SENSITIVITY, default: "normal" },
  authorOrgId: { type: ObjectId, ref: "Organization" },
  authorUserId: { type: ObjectId, ref: "User" },
  codeSystem: String,
  codeValue: String,
  codeDisplay: String,
  payloadVaultObjectId: { type: ObjectId, ref: "VaultObject" },
  effectiveAt: Date,
  version: { type: Number, default: 1 },
  contentDigest: String,
  createdAt: { type: Date, default: Date.now },
});
appendOnly(recordSchema, "clinical.records");

// ---------- consent ----------

const requestSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  requesterOrgId: { type: ObjectId, ref: "Organization" },
  requesterUserId: { type: ObjectId, ref: "User" },
  purpose: { type: String, enum: PURPOSES, required: true },
  justification: { type: String, minlength: [20, "Justification must be at least 20 characters"], required: true },
  requestedCategories: {
    type: [{ type: String, enum: CATEGORIES }],
    validate: [(v) => v.length > 0, "Request at least one category"],
  },
  durationDays: { type: Number, min: 1, max: 365 },
  status: { type: String, enum: ["pending", "approved", "denied"], default: "pending" },
  grantId: { type: ObjectId, ref: "Grant" },
  createdAt: { type: Date, default: Date.now },
  decidedAt: Date,
});

const scopeSchema = new Schema(
  {
    category: { type: String, enum: CATEGORIES },
    authorOrgId: { type: ObjectId, ref: "Organization" },
    from: Date,
    to: Date,
    isExclusion: { type: Boolean, default: false },
  },
  { _id: false }
);
scopeSchema.pre("validate", function () {
  if (!this.category && !this.authorOrgId && !this.from && !this.to) {
    throw new Error("A scope must narrow at least one dimension");
  }
});

const grantSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  requestId: { type: ObjectId, ref: "ConsentRequest" },
  granteeOrgId: { type: ObjectId, ref: "Organization" },
  purpose: { type: String, enum: PURPOSES },
  actions: [String],
  status: { type: String, enum: ["active", "revoked"], default: "active" },
  validFrom: Date,
  validUntil: {
    type: Date,
    validate: [function (v) { return v > this.validFrom; }, "valid_until must be after valid_from"],
  },
  maxUses: Number,
  useCount: { type: Number, default: 0 },
  scopes: { type: [scopeSchema], validate: [(v) => v.length > 0, "A grant needs at least one scope"] },
  subjectSignature: String,
  subjectAuthAal: Number,
  createdAt: { type: Date, default: Date.now },
  revokedAt: Date,
  revocationReason: String,
});

const eventSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  seq: Number,
  kind: String,
  grantId: ObjectId,
  requestId: ObjectId,
  actorUserId: ObjectId,
  payload: String,
  prevHash: String,
  entryHash: String,
  createdAt: Date,
});
eventSchema.index({ personId: 1, seq: 1 }, { unique: true });
appendOnly(eventSchema, "consent.events");

const breakGlassSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  invokedByUserId: { type: ObjectId, ref: "User" },
  orgId: { type: ObjectId, ref: "Organization" },
  justification: { type: String, minlength: [30, "Break-glass justification must be at least 30 characters"], required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: {
    type: Date,
    validate: [
      function (v) { return v > this.createdAt && v - this.createdAt <= 24 * 3600 * 1000; },
      "Break-glass TTL must be at most 24 hours",
    ],
  },
  reviewedAt: Date,
});

// ---------- audit ----------

const accessLogSchema = new Schema({
  personId: { type: ObjectId, index: true },
  seq: Number,
  recordId: ObjectId,
  category: String,
  actorUserId: ObjectId,
  actorOrgId: ObjectId,
  action: String,
  purpose: String,
  decision: { type: String, enum: ["allow", "deny"] },
  grantId: ObjectId,
  breakGlassId: ObjectId,
  denyReason: String,
  prevHash: String,
  entryHash: String,
  createdAt: Date,
});
accessLogSchema.index({ personId: 1, seq: 1 }, { unique: true });
appendOnly(accessLogSchema, "audit.access_log");

// ---------- ops ----------

const notificationSchema = new Schema({
  personId: { type: ObjectId, ref: "Person", index: true },
  kind: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
});

// Collection names mirror the PostgreSQL schemas from the design (identity.*, vault.*, ...).
export const Organization = model("Organization", organizationSchema, "identity.organizations");
export const Person = model("Person", personSchema, "identity.persons");
export const User = model("User", userSchema, "identity.users");
export const DataKey = model("DataKey", dataKeySchema, "vault.data_keys");
export const VaultObject = model("VaultObject", vaultObjectSchema, "vault.objects");
export const Record = model("Record", recordSchema, "clinical.records");
export const ConsentRequest = model("ConsentRequest", requestSchema, "consent.requests");
export const Grant = model("Grant", grantSchema, "consent.grants");
export const ConsentEvent = model("ConsentEvent", eventSchema, "consent.events");
export const BreakGlass = model("BreakGlass", breakGlassSchema, "consent.break_glass");
export const AccessLog = model("AccessLog", accessLogSchema, "audit.access_log");
export const Notification = model("Notification", notificationSchema, "ops.notifications");
