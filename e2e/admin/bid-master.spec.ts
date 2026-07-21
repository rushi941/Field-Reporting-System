import { test, expect } from "../helpers/fixtures";

test.describe("Bid master (System Admin)", () => {
  test.beforeEach(async ({ page, adminPage }) => {
    await page.goto("/system/bids");
    await expect(page.getByRole("heading", { name: "Bid master" })).toBeVisible();
  });

  test("loads bid master table", async ({ page }) => {
    await expect(page.getByRole("columnheader", { name: "Line code" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Bid / Sub-bid" }),
    ).toBeVisible();
  });

  test("create master bid modal auto-generates line code (no Code field)", async ({
    page,
  }) => {
    await page.getByRole("button", { name: /add master bid/i }).click();
    const modal = page.locator("#bid-form-modal");
    await expect(modal).toBeVisible();

    await expect(modal.getByText("Code", { exact: true })).toHaveCount(0);
    await expect(modal.locator("label").filter({ hasText: /generic name/i })).toBeVisible();
    await expect(
      modal.getByText(/line code is generated automatically/i),
    ).toBeVisible();

    await modal.getByRole("button", { name: /cancel/i }).click();
    await expect(modal).toBeHidden();
  });

  test("generic name column only appears when sub-bids exist", async ({
    page,
  }) => {
    const genericHeader = page.getByRole("columnheader", {
      name: "Generic name",
    });
    const subBidRows = page.locator("table tbody tr").filter({
      hasText: "Sub",
    });
    const subCount = await subBidRows.count();

    if (subCount === 0) {
      await expect(genericHeader).toHaveCount(0);
    } else {
      await expect(genericHeader).toBeVisible();
    }
  });
});
