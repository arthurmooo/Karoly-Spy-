import { expect, test } from "@playwright/test";
import { E2E_FIXTURES } from "./fixtures";
import { loginAsAdmin, loginAsCollaboratorCoach } from "./helpers";

test("admin can access structure admin pages", async ({ page }) => {
  await loginAsAdmin(page);

  await page.goto("/admin/coaches");
  await expect(page).toHaveURL(/\/admin\/coaches$/);
  await expect(page.getByRole("heading", { name: /Administration des coachs/i })).toBeVisible();
  await expect(page.getByText(E2E_FIXTURES.collaboratorCoach.email)).toBeVisible();

  await page.goto("/admin/assignments");
  await expect(page).toHaveURL(/\/admin\/assignments$/);
  await expect(page.getByRole("heading", { name: /Repartition des athletes/i })).toBeVisible();
  await expect(page.getByTestId(`admin-assignment-${E2E_FIXTURES.athlete.athleteId}`)).toBeVisible();
});

test("standard coach is redirected away from admin pages", async ({ page }) => {
  await loginAsCollaboratorCoach(page);

  await page.goto("/admin/coaches");
  await expect(page).toHaveURL(/\/dashboard$/);
});
