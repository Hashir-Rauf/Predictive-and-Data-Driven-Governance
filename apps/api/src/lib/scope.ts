import type { JwtClaims } from "../services/auth/jwt";

export interface DataScope {
  regionId?: number;
  agencyId?: number;
}

/**
 * Server-side scope derived from the token, never from client input. A
 * `municipal_viewer` or `soe_analyst`'s query-string filters may only
 * narrow within this scope, never widen it (docs/PLAN.md section 6).
 */
export function resolveScope(user: JwtClaims): DataScope {
  if (user.role === "ministry_admin") return {};
  if (user.role === "municipal_viewer") return user.regionId ? { regionId: user.regionId } : {};
  if (user.role === "soe_analyst") return user.agencyId ? { agencyId: user.agencyId } : {};
  return {};
}

/** Narrows a client-requested regionId against the token's scope; never widens it. */
export function narrowRegionId(scope: DataScope, requested: number | undefined): number | undefined {
  if (scope.regionId === undefined) return requested;
  if (requested === undefined || requested === scope.regionId) return scope.regionId;
  return -1; // impossible id: forces an empty result set rather than leaking out-of-scope data
}

export function narrowAgencyId(scope: DataScope, requested: number | undefined): number | undefined {
  if (scope.agencyId === undefined) return requested;
  if (requested === undefined || requested === scope.agencyId) return scope.agencyId;
  return -1;
}
