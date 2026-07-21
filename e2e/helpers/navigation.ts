import { expect, type Page } from "@playwright/test";

/** Assert page loaded without error state and optional heading. */
export async function expectPageReady(
  page: Page,
  opts?: { heading?: string | RegExp; url?: RegExp },
) {
  if (opts?.url) {
    await expect(page).toHaveURL(opts.url);
  }
  await expect(page.getByText(/failed to load|not found/i)).toHaveCount(0);
  if (opts?.heading) {
    await expect(page.getByRole("heading", { name: opts.heading })).toBeVisible({
      timeout: 20_000,
    });
  }
}

/** Wait for data tables to finish loading. */
export async function waitForTableRows(page: Page, minRows = 1) {
  const loader = page.getByText("Loading…");
  if (await loader.count()) {
    await loader.first().waitFor({ state: "hidden", timeout: 30_000 });
  }
  await expect(page.locator("table tbody tr").first()).toBeVisible({
    timeout: 30_000,
  });
  const count = await page.locator("table tbody tr").count();
  expect(count).toBeGreaterThanOrEqual(minRows);
}

export async function logout(page: Page) {
  const sidebarLogout = page.locator("aside").getByRole("button", {
    name: /log out/i,
  });
  if (await sidebarLogout.count()) {
    await sidebarLogout.click();
  } else {
    await page.getByRole("button", { name: /log out/i }).click();
  }
  await page.waitForURL(/\/login/, { timeout: 25_000 });
}
