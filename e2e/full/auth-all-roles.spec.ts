import { test, expect } from "@playwright/test";
import { loginAs, TEST_USERS, TEST_PASSWORD } from "../helpers/auth";
import { logout } from "../helpers/navigation";

const ALL_USERS = [
  { email: TEST_USERS.systemAdmin, home: /\/system/, label: "System Admin" },
  { email: TEST_USERS.projectAdmin, home: /\/office/, label: "Project Admin" },
  { email: TEST_USERS.manager, home: /\/approvals/, label: "Division Manager" },
  { email: TEST_USERS.fieldLead, home: /\/field\/projects/, label: "Field Lead" },
] as const;

test.describe("All logins — every role", () => {
  for (const user of ALL_USERS) {
    test(`${user.label} (${user.email}) login and home route`, async ({ page }) => {
      await loginAs(page, user.email);
      await expect(page).toHaveURL(user.home);
      await expect(page.getByText(/advance traffic/i).first()).toBeVisible();
    });
  }

  test("login form validates empty email", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/valid email|email/i).first()).toBeVisible();
  });

  test("login form validates short password", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(TEST_USERS.fieldLead);
    await page.locator("#password").fill("abc");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("wrong password stays on login", async ({ page }) => {
    await page.goto("/login");
    await page.locator("#email").fill(TEST_USERS.systemAdmin);
    await page.locator("#password").fill("WrongPassword999!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test("protected root redirects unauthenticated user to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("sequential login cycle all four roles", async ({ page }) => {
    for (const user of ALL_USERS) {
      await loginAs(page, user.email);
      await expect(page).toHaveURL(user.home);
      await logout(page);
    }
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Auth helpers sanity", () => {
  test("password constant matches seed", async () => {
    expect(TEST_PASSWORD).toBe("ChangeMe123!");
  });
});
