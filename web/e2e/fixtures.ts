export const E2E_FIXTURES = {
  coach: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "coach.e2e@projectk.test",
    password: "CoachE2E!2026",
  },
  athlete: {
    id: "11111111-1111-4111-8111-111111111111",
    athleteId: "33333333-3333-4333-8333-333333333333",
    email: "athlete.e2e@projectk.test",
    password: "AthleteE2E!2026",
  },
  activity: {
    id: "44444444-4444-4444-8444-444444444444",
    name: "Footing E2E du jour",
  },
  feedback: {
    rating: "4",
    text: "E2E athlete feedback persists after reload.",
  },
  coachComment: "E2E coach comment persists after reload.",
} as const;
