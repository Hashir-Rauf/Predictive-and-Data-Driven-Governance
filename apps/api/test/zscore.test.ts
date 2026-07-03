import { describe, expect, it } from "vitest";
import { classifyZScoreSeverity, detectZScoreAnomalies } from "../src/services/anomaly/zscore";

describe("classifyZScoreSeverity", () => {
  it("applies the warning/serious/critical thresholds", () => {
    expect(classifyZScoreSeverity(1.0)).toBeNull();
    expect(classifyZScoreSeverity(3.2)).toBe("warning");
    expect(classifyZScoreSeverity(4.0)).toBe("serious");
    expect(classifyZScoreSeverity(5.0)).toBe("critical");
  });
});

describe("detectZScoreAnomalies", () => {
  it("flags a planted spike but not ordinary residual noise", () => {
    const expected = [100, 100, 100, 100, 100, 100, 100, 100];
    const actual = [101, 99, 102, 98, 100, 250, 101, 99];
    const residualStdDev = 1.5;

    const anomalies = detectZScoreAnomalies(actual, expected, residualStdDev);

    expect(anomalies).toHaveLength(1);
    expect(anomalies[0]!.index).toBe(5);
    expect(anomalies[0]!.severity).toBe("critical");
  });

  it("returns no anomalies when residual stddev is zero", () => {
    expect(detectZScoreAnomalies([1, 2], [1, 2], 0)).toHaveLength(0);
  });
});
