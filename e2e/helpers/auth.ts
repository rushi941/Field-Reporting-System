import type { Page } from "@playwright/test";

export const TEST_PASSWORD = "ChangeMe123!";

export const TEST_USERS = {
  systemAdmin: "admin@frs.local",
  projectAdmin: "padmin@frs.local",
  manager: "manager@frs.local",
  fieldLead: "lead@frs.local",
} as const;

/** Sign in and wait until login route is left. */
export async function loginAs(page: Page, email: string, password = TEST_PASSWORD) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
}
