import { describe, expect, it } from "vitest";
import { calculateBusinessAlerts, calculateWeeklyReportHistory } from "./db";

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

describe("monthly profit goal alerts", () => {
  it("congratulates the team when monthly net profit reaches the target", () => {
    const alerts = calculateBusinessAlerts({
      now: new Date("2026-10-24T12:00:00.000Z"),
      sales: [],
      currentWeekUnitsSold: 0,
      weeklyTargetUnits: 500,
      currentMonthNetProfitCentavos: 5_000_000,
      monthlyProfitTargetCentavos: 5_000_000,
    });

    expect(alerts).toContainEqual(
      expect.objectContaining({
        kind: "goal_reached",
        title: "Monthly profit goal reached",
      })
    );
  });
});
