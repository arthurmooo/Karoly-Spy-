import { expect, test } from "@playwright/test";
import { E2E_FIXTURES } from "./fixtures";
import { loginAsCoach } from "./helpers";

test("coach can comment an activity from dashboard flow and open trends from alert", async ({ page }) => {
  await loginAsCoach(page);

  await expect(page.getByTestId(`recent-activity-${E2E_FIXTURES.activity.id}`)).toBeVisible();
  await page.getByTestId(`recent-activity-${E2E_FIXTURES.activity.id}`).click();

  await expect(page).toHaveURL(new RegExp(`/activities/${E2E_FIXTURES.activity.id}$`));
  await expect(page.locator('[data-testid="coach-feedback-panel"]:visible')).toBeVisible();

  const commentInput = page.locator('[data-testid="coach-comment-input"]:visible');
  const saveButton = page.locator('[data-testid="coach-comment-save"]:visible');

  await commentInput.fill(E2E_FIXTURES.coachComment);
  await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes("/functions/v1/update-coach-comment") && response.ok()
    ),
    saveButton.click(),
  ]);

  await page.reload();
  await expect(page.locator('[data-testid="coach-comment-input"]:visible')).toHaveValue(
    E2E_FIXTURES.coachComment
  );

  await page.goto("/dashboard");
  await expect(page.getByTestId(`health-alert-${E2E_FIXTURES.athlete.athleteId}`)).toBeVisible();
  await page.getByTestId(`health-alert-${E2E_FIXTURES.athlete.athleteId}`).click();

  await expect(page).toHaveURL(new RegExp(`/athletes/${E2E_FIXTURES.athlete.athleteId}/trends$`));
  await expect(page.getByTestId("athlete-trends-page")).toBeVisible();
  await expect(page.getByTestId("trends-swc-summary")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Tendances HRV .* SWC/i })).toBeVisible();
});
