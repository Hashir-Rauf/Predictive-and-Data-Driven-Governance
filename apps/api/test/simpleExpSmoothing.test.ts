import { describe, expect, it } from "vitest";
import {
  fitSimpleExpSmoothing,
  forecastSimpleExpSmoothing,
} from "../src/services/forecasting/simpleExpSmoothing";

describe("fitSimpleExpSmoothing", () => {
  it("converges toward the level of a flat series", () => {
    const fit = fitSimpleExpSmoothing([50, 51, 49, 50, 50, 51, 49], 0.4);
    expect(fit.level).toBeGreaterThan(48);
    expect(fit.level).toBeLessThan(52);
  });

  it("produces a widening confidence band with horizon", () => {
    const fit = fitSimpleExpSmoothing([10, 12, 11, 13, 12], 0.4);
    const values = forecastSimpleExpSmoothing(fit, 3);
    expect(values).toHaveLength(3);
    const band = (v: (typeof values)[number]) => v.upper - v.lower;
    expect(band(values[1]!)).toBeGreaterThan(band(values[0]!));
    expect(band(values[2]!)).toBeGreaterThan(band(values[1]!));
  });
});
