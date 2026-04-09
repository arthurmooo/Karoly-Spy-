// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LapsTable } from "./LapsTable";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("LapsTable", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
  });

  it("shows bike power without and with zeros in the laps table", async () => {
    await act(async () => {
      root.render(
        <LapsTable
          sportType="Bike"
          laps={[
            {
              lap_n: 1,
              start_sec: 0,
              duration_sec: 20,
              distance_m: 10000,
              avg_speed: 10,
              avg_power: 250,
              avg_hr: 150,
              max_hr: 160,
              avg_cadence: 90,
            },
          ]}
          streams={[
            { t: 0, elapsed_t: 0, pwr: 250 },
            { t: 5, elapsed_t: 5, pwr: 0 },
            { t: 10, elapsed_t: 10, pwr: 250 },
            { t: 15, elapsed_t: 15, pwr: 0 },
          ]}
        />
      );
    });

    expect(document.body.textContent).toContain("P sans 0");
    expect(document.body.textContent).toContain("250 W");
    expect(document.body.textContent).toContain("P avec 0");
    expect(document.body.textContent).toContain("125 W");
  });
});
