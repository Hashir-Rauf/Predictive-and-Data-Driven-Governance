export type Role = "ministry_admin" | "municipal_viewer" | "soe_analyst";
export type Locale = "uz" | "ru" | "en";

export interface UserSeed {
  externalIdHash: string;
  fullName: string;
  role: Role;
  regionCode: string | null;
  agencyCode: string | null;
  localePref: Locale;
}

// One persona per role, looked up by the mock login endpoint
// (POST /api/auth/login/mock { role }) — see docs/PLAN.md section 6.
export const USERS: UserSeed[] = [
  {
    externalIdHash: "mock-persona-ministry-admin",
    fullName: "Dilnoza Karimova",
    role: "ministry_admin",
    regionCode: null,
    agencyCode: null,
    localePref: "uz",
  },
  {
    externalIdHash: "mock-persona-municipal-viewer",
    fullName: "Aziz Yusupov",
    role: "municipal_viewer",
    regionCode: "SAM",
    agencyCode: "PSC-SAM",
    localePref: "uz",
  },
  {
    externalIdHash: "mock-persona-soe-analyst",
    fullName: "Elena Popova",
    role: "soe_analyst",
    regionCode: "TSH",
    agencyCode: "WTR-TSH",
    localePref: "ru",
  },
];
