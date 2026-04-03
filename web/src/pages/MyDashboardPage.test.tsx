// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MyDashboardPage } from "./MyDashboardPage";
import type { AthleteKpiReport, KpiPeriod, NormalizedStatsActivity } from "@/services/stats.service";

const useMyAthleteProfileMock = vi.fn();
const useAthleteKpisMock = vi.fn();
const useDashboardPreferencesMock = vi.fn();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useMyAthleteProfile", () => ({
  useMyAthleteProfile: () => useMyAthleteProfileMock(),
}));

vi.mock("@/hooks/useAthleteKpis", () => ({
  useAthleteKpis: (...args: unknown[]) => useAthleteKpisMock(...args),
}));

vi.mock("@/hooks/useDashboardPreferences", () => ({
  useDashboardPreferences: () => useDashboardPreferencesMock(),
}));

vi.mock("@/components/dashboard/LastSessionWidget", () => ({
  LastSessionWidget: () => <div>Dernière séance mock</div>,
}));

vi.mock("@/components/dashboard/NextPlannedWidget", () => ({
  NextPlannedWidget: () => <div>Prochaine séance mock</div>,
}));

vi.mock("@/components/dashboard/AcwrWidget", () => ({
  AcwrWidget: () => <div>ACWR mock</div>,
}));

vi.mock("@/components/dashboard/WellnessWidget", () => ({
  WellnessWidget: () => <div>Bien-être mock</div>,
}));

vi.mock("@/components/dashboard/CoachFeedbackWidget", () => ({
  CoachFeedbackWidget: () => <div>Feedback coach mock</div>,
}));

vi.mock("@/components/dashboard/DashboardSettingsDialog", () => ({
  DashboardSettingsDialog: () => null,
}));

function makeSession(
  id: string,
  sportKey: string,
  sportLabel: string,
  sessionDate: string
): NormalizedStatsActivity {
  return {
    activityId: id,
    sessionDate: new Date(sessionDate),
    sportKey,
    sportLabel,
    distanceM: 10000,
    durationSec: 3600,
    loadIndex: 80,
    rpe: 5,
    decouplingIndex: 4,
    durabilityIndex: 1,
    avgHr: 150,
    workType: "endurance",
    activityName: `${sportLabel} ${id}`,
    segmentedMetrics: null,
    hrZonesSec: null,
  };
}

function buildReport(period: KpiPeriod): AthleteKpiReport {
  const reportByPeriod: Record<KpiPeriod, AthleteKpiReport> = {
    week: {
      period: "week",
      periodLabel: "Cette semaine",
      currentRangeLabel: "31 mars — 3 avr",
      comparisonRangeLabel: "24 mars — 27 mars",
      cards: [
        { key: "distance", label: "Distance", value: 10, displayValue: "10,0 km", deltaPct: -20, deltaDisplay: "-20,0 %" },
        { key: "hours", label: "Heures", value: 2.5, displayValue: "2h30", deltaPct: -10, deltaDisplay: "-10,0 %" },
        { key: "sessions", label: "Séances", value: 3, displayValue: "3", deltaPct: 50, deltaDisplay: "+50,0 %" },
        { key: "rpe", label: "RPE moyen", value: 5, displayValue: "5,0", deltaPct: 25, deltaDisplay: "+25,0 %" },
      ],
      distribution: [
        { sportKey: "run", label: "Course à pied", durationSec: 5400, hours: 1.5, percent: 60, distanceKm: 8, avgRpe: 5, sessionCount: 2 },
        { sportKey: "bike", label: "Vélo", durationSec: 3600, hours: 1, percent: 40, distanceKm: 2, avgRpe: 5, sessionCount: 1 },
      ],
      weeklyLoad: [],
      volumeHistory: [],
      detailHeatmap: [],
      comparisonHeatmap: [],
      sportDecoupling: [],
      insights: [],
      focusAlert: null,
      hrZones: null,
      hrZonesBySport: {},
      availableSports: ["run", "bike"],
      sessions: [
        makeSession("week-run-1", "run", "Course à pied", "2026-04-01T09:00:00.000Z"),
        makeSession("week-run-2", "run", "Course à pied", "2026-04-02T09:00:00.000Z"),
        makeSession("week-bike-1", "bike", "Vélo", "2026-04-03T09:00:00.000Z"),
      ],
    },
    month: {
      period: "month",
      periodLabel: "Ce mois-ci",
      currentRangeLabel: "1 avr — 3 avr",
      comparisonRangeLabel: "1 mars — 3 mars",
      cards: [
        { key: "distance", label: "Distance", value: 42, displayValue: "42,0 km", deltaPct: 12, deltaDisplay: "+12,0 %" },
        { key: "hours", label: "Heures", value: 8, displayValue: "8h00", deltaPct: 5, deltaDisplay: "+5,0 %" },
        { key: "sessions", label: "Séances", value: 12, displayValue: "12", deltaPct: 20, deltaDisplay: "+20,0 %" },
        { key: "rpe", label: "RPE moyen", value: 5.8, displayValue: "5,8", deltaPct: 8, deltaDisplay: "+8,0 %" },
      ],
      distribution: [
        { sportKey: "run", label: "Course à pied", durationSec: 14400, hours: 4, percent: 50, distanceKm: 24, avgRpe: 5.5, sessionCount: 6 },
        { sportKey: "bike", label: "Vélo", durationSec: 10800, hours: 3, percent: 37.5, distanceKm: 12, avgRpe: 6, sessionCount: 4 },
        { sportKey: "swim", label: "Natation", durationSec: 3600, hours: 1, percent: 12.5, distanceKm: 6, avgRpe: 5, sessionCount: 2 },
      ],
      weeklyLoad: [],
      volumeHistory: [],
      detailHeatmap: [],
      comparisonHeatmap: [],
      sportDecoupling: [],
      insights: [],
      focusAlert: null,
      hrZones: null,
      hrZonesBySport: {},
      availableSports: ["run", "bike", "swim"],
      sessions: [
        makeSession("month-run-1", "run", "Course à pied", "2026-04-01T09:00:00.000Z"),
        makeSession("month-bike-1", "bike", "Vélo", "2026-04-02T09:00:00.000Z"),
        makeSession("month-swim-1", "swim", "Natation", "2026-04-03T09:00:00.000Z"),
      ],
    },
    year: {
      period: "year",
      periodLabel: "Cette année",
      currentRangeLabel: "1 janv — 3 avr",
      comparisonRangeLabel: "1 janv — 3 avr",
      cards: [
        { key: "distance", label: "Distance", value: 300, displayValue: "300,0 km", deltaPct: 18, deltaDisplay: "+18,0 %" },
        { key: "hours", label: "Heures", value: 40, displayValue: "40h00", deltaPct: 10, deltaDisplay: "+10,0 %" },
        { key: "sessions", label: "Séances", value: 48, displayValue: "48", deltaPct: 14, deltaDisplay: "+14,0 %" },
        { key: "rpe", label: "RPE moyen", value: 6.2, displayValue: "6,2", deltaPct: 3, deltaDisplay: "+3,0 %" },
      ],
      distribution: [
        { sportKey: "run", label: "Course à pied", durationSec: 72000, hours: 20, percent: 50, distanceKm: 180, avgRpe: 6, sessionCount: 24 },
        { sportKey: "bike", label: "Vélo", durationSec: 54000, hours: 15, percent: 37.5, distanceKm: 90, avgRpe: 6.5, sessionCount: 16 },
        { sportKey: "swim", label: "Natation", durationSec: 18000, hours: 5, percent: 12.5, distanceKm: 30, avgRpe: 5.5, sessionCount: 8 },
      ],
      weeklyLoad: [],
      volumeHistory: [],
      detailHeatmap: [],
      comparisonHeatmap: [],
      sportDecoupling: [],
      insights: [],
      focusAlert: null,
      hrZones: null,
      hrZonesBySport: {},
      availableSports: ["run", "bike", "swim"],
      sessions: [
        makeSession("year-run-1", "run", "Course à pied", "2026-02-01T09:00:00.000Z"),
        makeSession("year-bike-1", "bike", "Vélo", "2026-03-01T09:00:00.000Z"),
        makeSession("year-swim-1", "swim", "Natation", "2026-04-01T09:00:00.000Z"),
      ],
    },
  };

  return reportByPeriod[period];
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll("button")).find((node) =>
    node.textContent?.includes(text)
  ) as HTMLButtonElement | undefined;
}

describe("MyDashboardPage", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-03T12:00:00.000Z"));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useMyAthleteProfileMock.mockReset();
    useAthleteKpisMock.mockReset();
    useDashboardPreferencesMock.mockReset();

    useMyAthleteProfileMock.mockReturnValue({
      profile: { id: "athlete-1", first_name: "Tom", last_name: "V" },
      isLoading: false,
    });

    useDashboardPreferencesMock.mockReturnValue({
      prefs: { widgetOrder: ["weekly-summary", "sport-distribution"], hiddenWidgets: [] },
      visibleWidgets: ["weekly-summary", "sport-distribution"],
      toggleWidget: vi.fn(),
      moveWidget: vi.fn(),
      resetDefaults: vi.fn(),
    });

    useAthleteKpisMock.mockImplementation((_athleteId: string | null, period: KpiPeriod) => ({
      report: buildReport(period),
      isLoading: false,
    }));
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("switches between week, month and year KPIs from the athlete dashboard", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/mon-espace"]}>
          <MyDashboardPage />
        </MemoryRouter>
      );
    });

    expect(document.body.textContent).toContain("10,0 km");

    await act(async () => {
      findButtonByText("Mois")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("42,0 km");

    await act(async () => {
      findButtonByText("Année")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("300,0 km");
    expect(useAthleteKpisMock.mock.calls.some(([, period]) => period === "year")).toBe(true);
  });

  it("opens the KPI modal and carries the active period into the sessions link", async () => {
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={["/mon-espace?period=month"]}>
          <MyDashboardPage />
        </MemoryRouter>
      );
    });

    await act(async () => {
      findButtonByText("Séances")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await Promise.resolve();
    });

    expect(document.body.textContent).toContain("Course à pied");
    expect(document.body.textContent).toContain("Natation");
    expect(document.body.textContent).toContain("Total : 12");

    const sessionsLink = Array.from(document.querySelectorAll("a")).find((node) =>
      node.textContent?.includes("Voir toutes les séances")
    );

    expect(sessionsLink?.getAttribute("href")).toBe("/mon-espace/seances?from=2026-04-01&to=2026-04-03");
  });
});
