export type Sector =
  | "social_protection"
  | "utilities_water"
  | "utilities_power"
  | "transport"
  | "healthcare"
  | "education"
  | "tax"
  | "land_cadastre";

export type OrgType = "ministry" | "municipal" | "soe" | "agency";

export interface AgencySeed {
  code: string;
  regionCode: string | null;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  sector: Sector;
  orgType: OrgType;
  /** Baseline daily request volume — drives synthetic data generation scale. */
  baselineDailyRequests: number;
}

const REGIONAL_CENTER_CODES = [
  "TSH", "TSR", "AND", "BUX", "FAR", "JIZ", "NAM", "NAV", "QAS", "SAM", "SIR", "SUR", "XOR", "QOR",
];

const REGION_NAMES_EN: Record<string, string> = {
  TSH: "Tashkent City", TSR: "Tashkent Region", AND: "Andijan", BUX: "Bukhara", FAR: "Fergana",
  JIZ: "Jizzakh", NAM: "Namangan", NAV: "Navoiy", QAS: "Qashqadaryo", SAM: "Samarqand",
  SIR: "Sirdaryo", SUR: "Surkhandaryo", XOR: "Khorezm", QOR: "Karakalpakstan",
};
const REGION_NAMES_UZ: Record<string, string> = {
  TSH: "Toshkent shahri", TSR: "Toshkent viloyati", AND: "Andijon", BUX: "Buxoro", FAR: "Farg'ona",
  JIZ: "Jizzax", NAM: "Namangan", NAV: "Navoiy", QAS: "Qashqadaryo", SAM: "Samarqand",
  SIR: "Sirdaryo", SUR: "Surxondaryo", XOR: "Xorazm", QOR: "Qoraqalpog'iston",
};
const REGION_NAMES_RU: Record<string, string> = {
  TSH: "г. Ташкент", TSR: "Ташкентская область", AND: "Андижанская область", BUX: "Бухарская область",
  FAR: "Ферганская область", JIZ: "Джизакская область", NAM: "Наманганская область", NAV: "Навоийская область",
  QAS: "Кашкадарьинская область", SAM: "Самаркандская область", SIR: "Сырдарьинская область",
  SUR: "Сурхандарьинская область", XOR: "Хорезмская область", QOR: "Республика Каракалпакстан",
};

const regionalPublicServiceCenters: AgencySeed[] = REGIONAL_CENTER_CODES.map((code) => ({
  code: `PSC-${code}`,
  regionCode: code,
  nameUz: `${REGION_NAMES_UZ[code]} Davlat Xizmatlari Markazi`,
  nameRu: `Центр государственных услуг, ${REGION_NAMES_RU[code]}`,
  nameEn: `Public Service Center, ${REGION_NAMES_EN[code]}`,
  sector: "social_protection",
  orgType: "municipal",
  baselineDailyRequests: code === "TSH" ? 420 : code === "SAM" || code === "FAR" ? 260 : 150,
}));

const nationalMinistries: AgencySeed[] = [
  {
    code: "MOH",
    regionCode: null,
    nameUz: "Sog'liqni saqlash vazirligi",
    nameRu: "Министерство здравоохранения",
    nameEn: "Ministry of Health",
    sector: "healthcare",
    orgType: "ministry",
    baselineDailyRequests: 180,
  },
  {
    code: "MPE",
    regionCode: null,
    nameUz: "Maktabgacha va maktab ta'limi vazirligi",
    nameRu: "Министерство народного образования",
    nameEn: "Ministry of Public Education",
    sector: "education",
    orgType: "ministry",
    baselineDailyRequests: 140,
  },
  {
    code: "STC",
    regionCode: null,
    nameUz: "Davlat soliq qo'mitasi",
    nameRu: "Государственный налоговый комитет",
    nameEn: "State Tax Committee",
    sector: "tax",
    orgType: "ministry",
    baselineDailyRequests: 310,
  },
  {
    code: "LCA",
    regionCode: null,
    nameUz: "Yer kadastri agentligi",
    nameRu: "Агентство земельного кадастра",
    nameEn: "Land Cadastre Agency",
    sector: "land_cadastre",
    orgType: "agency",
    baselineDailyRequests: 210,
  },
];

const soeBranches: AgencySeed[] = [
  {
    code: "WTR-TSH",
    regionCode: "TSH",
    nameUz: "Toshkent Suv Ta'minoti",
    nameRu: "Ташкентводоканал",
    nameEn: "Tashkent Water Utility",
    sector: "utilities_water",
    orgType: "soe",
    baselineDailyRequests: 95,
  },
  {
    code: "WTR-SAM",
    regionCode: "SAM",
    nameUz: "Samarqand Suv Ta'minoti",
    nameRu: "Самарканд Водоканал",
    nameEn: "Samarqand Water Utility",
    sector: "utilities_water",
    orgType: "soe",
    baselineDailyRequests: 70,
  },
  {
    code: "WTR-FAR",
    regionCode: "FAR",
    nameUz: "Farg'ona Suv Ta'minoti",
    nameRu: "Фергана Водоканал",
    nameEn: "Fergana Water Utility",
    sector: "utilities_water",
    orgType: "soe",
    baselineDailyRequests: 65,
  },
  {
    code: "PWR-TSH",
    regionCode: "TSH",
    nameUz: "Toshkent Elektr Tarmoqlari",
    nameRu: "Ташкентские электросети",
    nameEn: "Tashkent Power Grid",
    sector: "utilities_power",
    orgType: "soe",
    baselineDailyRequests: 110,
  },
  {
    code: "PWR-BUX",
    regionCode: "BUX",
    nameUz: "Buxoro Elektr Tarmoqlari",
    nameRu: "Бухарские электросети",
    nameEn: "Bukhara Power Grid",
    sector: "utilities_power",
    orgType: "soe",
    baselineDailyRequests: 60,
  },
  {
    code: "TRN-TSH",
    regionCode: "TSH",
    nameUz: "Toshkent Transport Xizmati",
    nameRu: "Ташкентский транспорт",
    nameEn: "Tashkent Transport Authority",
    sector: "transport",
    orgType: "soe",
    baselineDailyRequests: 80,
  },
  {
    code: "TRN-SAM",
    regionCode: "SAM",
    nameUz: "Samarqand Transport Xizmati",
    nameRu: "Самаркандский транспорт",
    nameEn: "Samarqand Transport Authority",
    sector: "transport",
    orgType: "soe",
    baselineDailyRequests: 45,
  },
];

export const AGENCIES: AgencySeed[] = [...regionalPublicServiceCenters, ...nationalMinistries, ...soeBranches];

export const WATER_POWER_SOE_CODES = soeBranches
  .filter((a) => a.sector === "utilities_water" || a.sector === "utilities_power")
  .map((a) => a.code);
