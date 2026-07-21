import { test, expect } from "../helpers/fixtures";
import { expectPageReady, logout, waitForTableRows } from "../helpers/navigation";

test.describe("System Admin — all pages & forms", () => {
  test.beforeEach(async ({ page, adminPage }) => {
    await expect(page).toHaveURL(/\/system/);
  });

  test("overview dashboard", async ({ page }) => {
    await page.goto("/system");
    await expectPageReady(page, { heading: "Overview" });
    await expect(page.getByText(/welcome/i)).toBeVisible();
    await expect(page.getByText("Users").first()).toBeVisible();
    await expect(page.getByText("Permissions").first()).toBeVisible();
  });

  test("projects list and create modal inputs", async ({ page }) => {
    await page.goto("/system/projects");
    await expectPageReady(page, { heading: "Projects" });
    await page.getByRole("button", { name: /add project/i }).click();
    const modal = page.locator("#project-form-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText(/name/i).first()).toBeVisible();
    await expect(modal.getByText(/division/i).first()).toBeVisible();
    await modal.getByRole("button", { name: /cancel/i }).click();
  });

  test("project types master", async ({ page }) => {
    await page.goto("/system/project-types");
    await expectPageReady(page, { heading: "Project types" });
    await page.getByRole("button", { name: /add type/i }).click();
    await expect(
      page.getByRole("heading", { name: /new project type|edit project type/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("units master with table rows", async ({ page }) => {
    await page.goto("/system/units");
    await expectPageReady(page, { heading: "Units" });
    await waitForTableRows(page);
    await page.getByRole("button", { name: /add unit/i }).click();
    await expect(page.getByText("Code").first()).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("bid master table and create modal", async ({ page }) => {
    await page.goto("/system/bids");
    await expectPageReady(page, { heading: "Bid master" });
    await page.getByRole("button", { name: /add master bid/i }).click();
    const modal = page.locator("#bid-form-modal");
    await expect(modal).toBeVisible();
    await expect(modal.locator("label").filter({ hasText: /generic name/i })).toBeVisible();
    await expect(modal.getByText("Code", { exact: true })).toHaveCount(0);
    await modal.getByRole("button", { name: /cancel/i }).click();
  });

  test("billing rollup", async ({ page }) => {
    await page.goto("/system/billing");
    await expectPageReady(page, { heading: "Billing" });
  });

  test("users list and create modal", async ({ page }) => {
    await page.goto("/system/users");
    await expectPageReady(page, { heading: "Users" });
    await waitForTableRows(page);
    await page.getByRole("button", { name: /add user/i }).click();
    await expect(page.getByText("First name").first()).toBeVisible();
    await expect(page.getByText("Last name").first()).toBeVisible();
    await expect(page.getByText("Email").first()).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();
  });

  test("permissions matrix", async ({ page }) => {
    await page.goto("/system/permissions");
    await expectPageReady(page, { heading: "Permissions" });
    await expect(page.getByRole("button", { name: /save matrix/i })).toBeVisible();
    await waitForTableRows(page, 5);
  });

  test("sidebar navigation visits all modules", async ({ page }) => {
    const links = [
      { label: "Overview", heading: "Overview" },
      { label: "Projects", heading: "Projects" },
      { label: "Billing", heading: "Billing" },
      { label: "Project types", heading: "Project types" },
      { label: "Units", heading: "Units" },
      { label: "Bid master", heading: "Bid master" },
      { label: "Users", heading: "Users" },
      { label: "Permissions", heading: "Permissions" },
    ];
    for (const item of links) {
      await page.getByRole("link", { name: item.label, exact: true }).click();
      await expectPageReady(page, { heading: item.heading });
    }
  });

  test("project detail when JOB-1001 exists", async ({ page }) => {
    await page.goto("/system/projects");
    const jobCell = page.getByText("JOB-1001").first();
    if ((await jobCell.count()) === 0) {
      test.skip(true, "Seed project JOB-1001 not in list");
      return;
    }
    await jobCell.click();
    await page.waitForURL(/\/system\/projects\//);
    await expect(page.getByRole("heading", { name: /US-30/i })).toBeVisible();
    await expect(page.getByText("Project tasks")).toBeVisible();
    await page.getByRole("button", { name: /add task/i }).click();
    await expect(page.locator("#project-task-form-modal")).toBeVisible();
    await page.locator("#project-task-form-modal").getByRole("button", { name: /cancel/i }).click();
  });
});
