import { describe, expect, it } from "vitest";
import { calculateWeeklyReportHistory } from "./db";

describe("calculateWeeklyReportHistory", () => {
  it("reports combined gross profit earned for both owners", () => {
    const history = calculateWeeklyReportHistory({
      now: new Date("2026-10-05T12:00:00.000Z"),
      currentTargetUnits: 500,
      weeks: 2,
      targets: [
        {
          weekStartDate: new Date("2026-10-05T00:00:00.000Z"),
          targetUnits: 500,
        },
        {
          weekStartDate: new Date("2026-09-28T00:00:00.000Z"),
          targetUnits: 500,
        },
      ],
      sales: [
        {
          saleDate: new Date("2026-09-29T12:00:00.000Z"),
          unitsSold: 72,
          grossProfitCentavos: 216_000,
          isVoided: false,
        },
        {
          saleDate: new Date("2026-10-04T12:00:00.000Z"),
          unitsSold: 30,
          grossProfitCentavos: 90_000,
          isVoided: false,
        },
        {
          saleDate: new Date("2026-10-02T12:00:00.000Z"),
          unitsSold: 10,
          grossProfitCentavos: 30_000,
          isVoided: true,
        },
      ],
    });

    expect(history[0]).toMatchObject({
      weekStartDate: "2026-10-05",
      unitsSold: 0,
      profitEarnedCentavos: 0,
    });
    expect(history[1]).toMatchObject({
      weekStartDate: "2026-09-28",
      unitsSold: 102,
      profitEarnedCentavos: 306_000,
    });
    expect(history[1]).not.toHaveProperty("cashVarianceCentavos");
  });
});
