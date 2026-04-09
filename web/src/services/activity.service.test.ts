import { describe, expect, it } from "vitest";
import { formatActivityRow, getBikePowerMetrics } from "./activity.service";

describe("activity.service bike power helpers", () => {
  it("reads power without zeros from avg_power", () => {
    expect(
      getBikePowerMetrics({
        avg_power: 287.5,
        source_json: null,
      }).powerWithoutZeros
    ).toBe(287.5);
  });

  it("parses source_json.avg_watt and np when values are strings", () => {
    expect(
      getBikePowerMetrics({
        avg_power: 287.5,
        source_json: { avg_watt: "270.0", np: "288.0" },
      })
    ).toEqual({
      powerWithoutZeros: 287.5,
      powerWithZeros: 270,
      normalizedPower: 288,
    });
  });

  it("returns null for missing or invalid avg_watt", () => {
    expect(
      getBikePowerMetrics({
        avg_power: 287.5,
        source_json: { avg_watt: "abc" },
      }).powerWithZeros
    ).toBeNull();

    expect(
      getBikePowerMetrics({
        avg_power: 287.5,
        source_json: {},
      }).powerWithZeros
    ).toBeNull();
  });

  it("formats bike activity rows with explicit without/with zero labels", () => {
    const row = formatActivityRow({
      id: "activity-1",
      athlete_id: "athlete-1",
      athletes: { first_name: "Romain", last_name: "Rezsohazy" },
      session_date: "2026-04-05T08:04:19.000Z",
      sport_type: "Bike",
      source_sport: "Vélo - Route",
      work_type: "endurance",
      activity_name: "ENC Tempo Full Vélo - 45Km Tempo",
      manual_activity_name: null,
      duration_sec: 7067,
      moving_time_sec: 7067,
      distance_m: 72478,
      load_index: 90,
      avg_hr: 140,
      avg_power: 287.5,
      rpe: 6,
      source_json: { avg_watt: "270.0", np: "288.0" },
    });

    expect(row.pace).toBe("Sans les 0: 288 W");
    expect(row.paceSecondary).toBe("Avec les 0: 270 W");
    expect(row.pace_sort_value).toBe(287.5);
  });
});
