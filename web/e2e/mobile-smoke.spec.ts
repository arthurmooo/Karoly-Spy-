import { expect, test } from "@playwright/test";
import { E2E_FIXTURES } from "./fixtures";
import { assertWithinViewport, loginAsAthlete, loginAsCoach } from "./helpers";

test("coach mobile drawer opens and critical dashboard controls stay reachable", async ({ page }) => {
  await loginAsCoach(page);

  const menuButton = page.getByTestId("coach-mobile-menu-button");
  await expect(menuButton).toBeVisible();
  await assertWithinViewport(page, menuButton);

  await menuButton.click();
  await expect(page.getByTestId("coach-mobile-drawer")).toBeVisible();
  await page.getByTestId("coach-nav-calendar-mobile").click();
  await expect(page).toHaveURL(/\/calendar/);
});

test("athlete mobile drawer and activity feedback remain reachable", async ({ page }) => {
  await loginAsAthlete(page);

  const menuButton = page.getByTestId("athlete-mobile-menu-button");
  await expect(menuButton).toBeVisible();
  await assertWithinViewport(page, menuButton);

  await menuButton.click();
  await expect(page.getByTestId("athlete-mobile-drawer")).toBeVisible();
  await page.getByTestId("athlete-nav-calendar-mobile").click();
  await expect(page).toHaveURL(/\/mon-espace\/calendrier/);

  const activityCard = page.getByTestId(`calendar-event-${E2E_FIXTURES.activity.id}`).first();
  await expect(activityCard).toBeVisible();
  await activityCard.click();
  await expect(page).toHaveURL(new RegExp(`/mon-espace/activities/${E2E_FIXTURES.activity.id}$`));

  const saveButton = page.locator('[data-testid="athlete-feedback-save"]:visible');
  await saveButton.scrollIntoViewIfNeeded();
  await expect(saveButton).toBeVisible();
  await assertWithinViewport(page, saveButton);
});
