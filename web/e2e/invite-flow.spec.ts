import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createAthleteInviteLink, createCoachInviteLink } from "./invite-helpers";

test("coach invite link can be accepted end-to-end", async ({ page, baseURL }) => {
  const email = `coach.invite.${randomUUID()}@projectk.test`;
  const inviteLink = await createCoachInviteLink(
    email,
    "Coach Invite E2E",
    `${baseURL}/accept-invite`
  );

  await page.goto(inviteLink);
  await expect(page).toHaveURL(/\/accept-invite/);

  await page.locator("#invite-password").fill("CoachInviteE2E!2026");
  await page.locator("#invite-confirm-password").fill("CoachInviteE2E!2026");
  await page.getByRole("button", { name: /Activer mon acces/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
});

test("athlete invite link can be accepted end-to-end", async ({ page, baseURL }) => {
  const email = `athlete.invite.${randomUUID()}@projectk.test`;
  const athleteId = randomUUID();
  const inviteLink = await createAthleteInviteLink(
    email,
    "Athlete Invite E2E",
    athleteId,
    `${baseURL}/accept-invite`
  );

  await page.goto(inviteLink);
  await expect(page).toHaveURL(/\/accept-invite/);

  await page.locator("#invite-password").fill("AthleteInviteE2E!2026");
  await page.locator("#invite-confirm-password").fill("AthleteInviteE2E!2026");
  await page.getByRole("button", { name: /Activer mon acces/i }).click();

  await expect(page).toHaveURL(/\/mon-espace$/);
});

test("invalid invite link shows a user-facing error instead of a blank page", async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/accept-invite?token_hash=invalid&type=invite`);

  await expect(page.getByRole("heading", { name: /Invitation invalide/i })).toBeVisible();
  await expect(page.getByText(/invalide|expire/i)).toBeVisible();
});
