import { Grant, BreakGlass } from "./models";

// The equivalent of authz.can_access_record(): self, org ceiling, break-glass, or a matching grant scope.

const same = (a, b) => a != null && b != null && String(a) === String(b);

export async function loadAccessContext(actor, personId) {
  const now = new Date();
  if (!actor.org) return { now, grants: [], breakGlass: null };
  const [grants, breakGlass] = await Promise.all([
    Grant.find({ personId, granteeOrgId: actor.org._id, status: "active" }).lean(),
    BreakGlass.findOne({ personId, invokedByUserId: actor.user._id, expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .lean(),
  ]);
  return { now, grants, breakGlass };
}

// Every dimension a scope row sets must match; scope rows are OR-ed.
function scopeMatches(scope, record) {
  if (scope.category && scope.category !== record.category) return false;
  if (scope.authorOrgId && !same(scope.authorOrgId, record.authorOrgId)) return false;
  if (scope.from && record.effectiveAt < scope.from) return false;
  if (scope.to && record.effectiveAt > scope.to) return false;
  return true;
}

const deny = (denyReason) => ({ decision: "deny", denyReason });

export function decideAccess(actor, record, purpose, ctx) {
  const { user, org } = actor;
  if (same(user.personId, record.personId)) return { decision: "allow", basis: "self" };
  if (!org) return deny("no_organisation");

  // Gate 1: the organisation's hard ceiling, independent of consent.
  if (!org.permittedCategories.includes(record.category)) return deny(`org_ceiling:${record.category}`);

  // Emergency override.
  if (ctx.breakGlass) return { decision: "allow", basis: "break_glass", breakGlassId: ctx.breakGlass._id };

  // Gate 2: the patient's consent.
  const live = ctx.grants.filter((g) => g.validFrom <= ctx.now && g.validUntil > ctx.now);
  if (!live.length) return deny("no_active_grant");
  const forPurpose = live.filter((g) => g.purpose === purpose);
  if (!forPurpose.length) return deny(`purpose_mismatch:${purpose}`);
  const usable = forPurpose.filter((g) => g.maxUses == null || g.useCount < g.maxUses);
  if (!usable.length) return deny("grant_uses_exhausted");

  let excludedBy = null;
  for (const g of usable) {
    const exclusion = g.scopes.find((s) => s.isExclusion && scopeMatches(s, record));
    if (exclusion) {
      excludedBy = exclusion; // explicit deny beats any allow
      continue;
    }
    if (g.scopes.some((s) => !s.isExclusion && scopeMatches(s, record))) {
      return { decision: "allow", basis: "grant", grantId: g._id };
    }
  }
  return deny(excludedBy ? `scope_exclusion:${excludedBy.category || "rule"}` : "out_of_scope");
}
