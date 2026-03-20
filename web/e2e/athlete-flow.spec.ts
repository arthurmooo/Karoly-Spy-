import { expect, test } from "@playwright/test";
import { E2E_FIXTURES } from "./fixtures";
import { loginAsAthlete, openSeededActivityFromCalendar } from "./helpers";

test("invalid login shows an error without crashing", async ({ page }) => {
  await page.goto("/login");
  await page.getByTestId("login-email").fill("wrong@projectk.test");
  await page.getByTestId("login-password").fill("bad-password");
  await page.getByTestId("login-submit").click();

  await expect(page.getByText("Identifiants incorrects. Veuillez réessayer.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("athlete can navigate from calendar to activity detail and persist feedback", async ({ page }) => {
  await loginAsAthlete(page);

  await openSeededActivityFromCalendar(page, "athlete-nav-calendar");
  await expect(page).toHaveURL(new RegExp(`/mon-espace/activities/${E2E_FIXTURES.activity.id}$`));
  await expect(page.locator('[data-testid="athlete-feedback-panel"]:visible')).toBeVisible();

  const ratingButton = page.locator(
    `[data-testid="athlete-feedback-rating-${E2E_FIXTURES.feedback.rating}"]:visible`
  );
  const commentInput = page.locator('[data-testid="athlete-feedback-text"]:visible');
  const saveButton = page.locator('[data-testid="athlete-feedback-save"]:visible');

  await ratingButton.click();
  await commentInput.fill(E2E_FIXTURES.feedback.text);
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/functions/v1/update-athlete-feedback") && response.ok()
    ),
    saveButton.click(),
  ]);

  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/mon-espace/activities/${E2E_FIXTURES.activity.id}$`));

  await expect(
    page.locator(`[data-testid="athlete-feedback-rating-${E2E_FIXTURES.feedback.rating}"]:visible`)
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[data-testid="athlete-feedback-text"]:visible')).toHaveValue(
    E2E_FIXTURES.feedback.text
  );
});
