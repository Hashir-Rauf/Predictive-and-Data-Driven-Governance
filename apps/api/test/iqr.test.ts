import { describe, expect, it } from "vitest";
import { computeIqrFences, detectIqrOutliers } from "../src/services/anomaly/iqr";

describe("computeIqrFences", () => {
  it("computes fences that bracket q1/q3", () => {
    const fences = computeIqrFences([10, 12, 14, 15, 16, 18, 20]);
    expect(fences.q1).toBeLessThan(fences.q3);
    expect(fences.lowerFence).toBeLessThan(fences.q1);
    expect(fences.upperFence).toBeGreaterThan(fences.q3);
  });
});

describe("detectIqrOutliers", () => {
  it("flags a planted collection-rate dip below its peers", () => {
    const entities = [
      { entity: "regionA", value: 0.92 },
      { entity: "regionB", value: 0.91 },
      { entity: "regionC", value: 0.93 },
      { entity: "regionD", value: 0.9 },
      { entity: "regionE", value: 0.94 },
      { entity: "regionF", value: 0.55 },
    ];

    const outliers = detectIqrOutliers(entities);

    expect(outliers).toHaveLength(1);
    expect(outliers[0]!.entity).toBe("regionF");
    expect(outliers[0]!.direction).toBe("below");
  });

  it("flags nothing when all values are close together", () => {
    const entities = [1, 2, 3, 2, 1, 2, 3].map((value, i) => ({ entity: `e${i}`, value }));
    expect(detectIqrOutliers(entities)).toHaveLength(0);
  });
});
