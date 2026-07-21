import { test, expect } from "@playwright/test";
import { loginAs, TEST_USERS } from "../helpers/auth";

/** Common phone viewports including Samsung Galaxy sizes */
const MOBILE_VIEWPORTS = [
  { name: "iPhone SE", width: 320, height: 568 },
  { name: "Galaxy S8", width: 360, height: 740 },
  { name: "Galaxy S21", width: 360, height: 800 },
  { name: "Galaxy S24", width: 412, height: 915 },
  { name: "iPhone 14", width: 390, height: 844 },
  { name: "Galaxy Fold narrow", width: 280, height: 653 },
] as const;

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  expect(overflow, "page should not scroll horizontally").toBeLessThanOrEqual(1);
}

for (const viewport of MOBILE_VIEWPORTS) {
  test.describe(`Field Lead @ ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("projects list layout", async ({ page }) => {
      await loginAs(page, TEST_USERS.fieldLead);
      await page.goto("/field/projects");
      await expect(page.getByPlaceholder(/search by job/i)).toBeVisible();
      await expect(page.getByRole("navigation", { name: /field navigation/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });

    test("reports list layout", async ({ page }) => {
      await loginAs(page, TEST_USERS.fieldLead);
      await page.goto("/field/reports");
      await expect(page.getByRole("navigation", { name: /field navigation/i })).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });
  });

  test.describe(`Division Manager @ ${viewport.name} (${viewport.width}px)`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("approvals queue layout", async ({ page }) => {
      await loginAs(page, TEST_USERS.manager);
      await page.goto("/approvals");
      await expect(page.getByRole("heading", { name: /pending approval/i })).toBeVisible();
      await expect(page.getByRole("button").first()).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });

    test("history page layout", async ({ page }) => {
      await loginAs(page, TEST_USERS.manager);
      await page.goto("/approvals/history");
      await expect(
        page.getByRole("heading", { name: /project report history/i }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page);
    });

    test("mobile menu opens and closes", async ({ page }) => {
      await loginAs(page, TEST_USERS.manager);
      await page.goto("/approvals");
      const menuToggle = page.locator("header button[aria-expanded]");
      await menuToggle.click();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
      await menuToggle.click();
      await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
      await assertNoHorizontalOverflow(page);
    });
  });
}
