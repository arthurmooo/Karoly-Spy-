import { expect, type Locator, type Page } from "@playwright/test";
import { E2E_FIXTURES } from "./fixtures";

export async function loginAsCoach(page: Page) {
  await login(page, E2E_FIXTURES.coach.email, E2E_FIXTURES.coach.password);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsAdmin(page: Page) {
  await login(page, E2E_FIXTURES.admin.email, E2E_FIXTURES.admin.password);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsCollaboratorCoach(page: Page) {
  await login(page, E2E_FIXTURES.collaboratorCoach.email, E2E_FIXTURES.collaboratorCoach.password);
  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginAsAthlete(page: Page) {
  await login(page, E2E_FIXTURES.athlete.email, E2E_FIXTURES.athlete.password);
  await expect(page).toHaveURL(/\/mon-espace$/);
}

export async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByTestId("login-email").fill(email);
  await page.getByTestId("login-password").fill(password);
  await page.getByTestId("login-submit").click();
}

export async function openSeededActivityFromCalendar(page: Page, navTestId: string) {
  await page.getByTestId(navTestId).click();
  await expect(page).toHaveURL(/calendrier/);
  await page.getByTestId(`calendar-event-${E2E_FIXTURES.activity.id}`).first().click();
}

export async function assertWithinViewport(page: Page, locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;

  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  if (!viewport) return;

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}
