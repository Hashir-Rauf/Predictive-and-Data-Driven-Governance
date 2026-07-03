export interface RegionSeed {
  code: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  population: number;
  isCapital: boolean;
}

// Uzbekistan's 14 top-level administrative divisions: Tashkent city, the
// Republic of Karakalpakstan, and 12 viloyats. Population figures are
// realistic approximations for synthetic-data purposes, not census data.
export const REGIONS: RegionSeed[] = [
  { code: "TSH", nameUz: "Toshkent shahri", nameRu: "город Ташкент", nameEn: "Tashkent City", population: 2860000, isCapital: true },
  { code: "TSR", nameUz: "Toshkent viloyati", nameRu: "Ташкентская область", nameEn: "Tashkent Region", population: 2980000, isCapital: false },
  { code: "AND", nameUz: "Andijon viloyati", nameRu: "Андижанская область", nameEn: "Andijan Region", population: 3200000, isCapital: false },
  { code: "BUX", nameUz: "Buxoro viloyati", nameRu: "Бухарская область", nameEn: "Bukhara Region", population: 2010000, isCapital: false },
  { code: "FAR", nameUz: "Farg'ona viloyati", nameRu: "Ферганская область", nameEn: "Fergana Region", population: 3820000, isCapital: false },
  { code: "JIZ", nameUz: "Jizzax viloyati", nameRu: "Джизакская область", nameEn: "Jizzakh Region", population: 1510000, isCapital: false },
  { code: "NAM", nameUz: "Namangan viloyati", nameRu: "Наманганская область", nameEn: "Namangan Region", population: 3010000, isCapital: false },
  { code: "NAV", nameUz: "Navoiy viloyati", nameRu: "Навоийская область", nameEn: "Navoiy Region", population: 1080000, isCapital: false },
  { code: "QAS", nameUz: "Qashqadaryo viloyati", nameRu: "Кашкадарьинская область", nameEn: "Qashqadaryo Region", population: 3340000, isCapital: false },
  { code: "SAM", nameUz: "Samarqand viloyati", nameRu: "Самаркандская область", nameEn: "Samarqand Region", population: 4010000, isCapital: false },
  { code: "SIR", nameUz: "Sirdaryo viloyati", nameRu: "Сырдарьинская область", nameEn: "Sirdaryo Region", population: 820000, isCapital: false },
  { code: "SUR", nameUz: "Surxondaryo viloyati", nameRu: "Сурхандарьинская область", nameEn: "Surkhandaryo Region", population: 2710000, isCapital: false },
  { code: "XOR", nameUz: "Xorazm viloyati", nameRu: "Хорезмская область", nameEn: "Khorezm Region", population: 1920000, isCapital: false },
  { code: "QOR", nameUz: "Qoraqalpog'iston Respublikasi", nameRu: "Республика Каракалпакстан", nameEn: "Republic of Karakalpakstan", population: 2010000, isCapital: false },
];
