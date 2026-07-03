import { monthLabelForIndex, RNG_SEED, UTILITY_MONTHS } from "../config";
import { createRng, gaussian } from "../rng";
import type { AgencySeed, Sector } from "./agencies";
import { UTILITY_COLLECTION_ANOMALIES } from "./plantedAnomalies";

export type UtilityServiceType = "water" | "electricity" | "gas";

export interface UtilityConsumptionRow {
  agencyCode: string;
  yearMonth: string;
  serviceType: UtilityServiceType;
  consumptionUnits: number;
  billedAmount: number;
  collectedAmount: number;
  arrearsAmount: number;
  meterCount: number;
}

const SERVICE_TYPE_BY_SECTOR: Partial<Record<Sector, UtilityServiceType>> = {
  utilities_water: "water",
  utilities_power: "electricity",
};

export function generateUtilityBilling(agencies: AgencySeed[]): UtilityConsumptionRow[] {
  const rng = createRng(RNG_SEED + 4);
  const rows: UtilityConsumptionRow[] = [];

  const utilityAgencies = agencies.filter((a) => SERVICE_TYPE_BY_SECTOR[a.sector]);

  for (const agency of utilityAgencies) {
    const serviceType = SERVICE_TYPE_BY_SECTOR[agency.sector]!;
    const meterCount = Math.round(agency.baselineDailyRequests * 45 * (0.9 + rng() * 0.4));
    const anomaly = UTILITY_COLLECTION_ANOMALIES.find((a) => a.agencyCode === agency.code);

    for (let index = 0; index < UTILITY_MONTHS; index++) {
      const yearMonth = monthLabelForIndex(index, UTILITY_MONTHS);
      const seasonalMultiplier = serviceType === "electricity" ? seasonalElectricity(yearMonth) : seasonalWater(yearMonth);
      const consumptionUnits = Math.max(
        0,
        Math.round(meterCount * seasonalMultiplier * gaussian(rng, 38, 4) * 100) / 100
      );
      const unitPrice = serviceType === "electricity" ? 720 : 1450; // UZS-scale synthetic unit price
      const billedAmount = Math.round(consumptionUnits * unitPrice);

      const normalCollectionRate = Math.min(0.98, Math.max(0.85, gaussian(rng, 0.92, 0.02)));
      const collectionRate = anomaly && anomaly.monthIndex === index ? anomaly.collectionRate : normalCollectionRate;
      const collectedAmount = Math.round(billedAmount * collectionRate);
      const arrearsAmount = billedAmount - collectedAmount;

      rows.push({
        agencyCode: agency.code,
        yearMonth,
        serviceType,
        consumptionUnits,
        billedAmount,
        collectedAmount,
        arrearsAmount,
        meterCount,
      });
    }
  }

  return rows;
}

function seasonalElectricity(yearMonth: string): number {
  const month = Number(yearMonth.split("-")[1]);
  // Winter heating + summer cooling both push electricity consumption up.
  const winterPeak = Math.exp(-((month - 1) ** 2) / 8) + Math.exp(-((month - 13) ** 2) / 8);
  const summerPeak = Math.exp(-((month - 7) ** 2) / 6);
  return 0.85 + 0.35 * Math.max(winterPeak, summerPeak);
}

function seasonalWater(yearMonth: string): number {
  const month = Number(yearMonth.split("-")[1]);
  const summerPeak = Math.exp(-((month - 7) ** 2) / 8);
  return 0.9 + 0.3 * summerPeak;
}
