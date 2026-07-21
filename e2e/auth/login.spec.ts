import { test, expect } from "@playwright/test";
import { loginAs, TEST_USERS } from "../helpers/auth";

test.describe("Login & role routing", () => {
  test("shows sign in page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("rejects invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill("nobody@frs.local");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("system admin lands on /system", async ({ page }) => {
    await loginAs(page, TEST_USERS.systemAdmin);
    await expect(page).toHaveURL(/\/system/);
  });

  test("project admin lands on /office", async ({ page }) => {
    await loginAs(page, TEST_USERS.projectAdmin);
    await expect(page).toHaveURL(/\/office/);
  });

  test("division manager lands on /approvals", async ({ page }) => {
    await loginAs(page, TEST_USERS.manager);
    await expect(page).toHaveURL(/\/approvals/);
  });

  test("field lead lands on /field/projects", async ({ page }) => {
    await loginAs(page, TEST_USERS.fieldLead);
    await expect(page).toHaveURL(/\/field\/projects/);
  });

  test("password field can be toggled visible", async ({ page }) => {
    await page.goto("/login");
    const password = page.locator("#password");
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: /show password/i }).click();
    await expect(password).toHaveAttribute("type", "text");
  });
});
