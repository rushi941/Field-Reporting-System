import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "docs", "screenshots");
const base = process.env.FRS_WEB_URL ?? "http://localhost:5174";

async function login(page, email) {
  await page.goto(`${base}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("ChangeMe123!");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30_000 });
}

const browser = await chromium.launch();

async function withUser(email, fn) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await login(page, email);
  await fn(page);
  await ctx.close();
}

await withUser("lead@frs.local", async (page) => {
  await page.goto(`${base}/field/projects`);
  await page.waitForLoadState("networkidle");
  const projectLink = page.locator('a[href*="/field/projects/"]').first();
  if (await projectLink.count()) {
    await projectLink.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(out, "04-field-project-detail.png"), fullPage: true });
    console.log("✓ 04-field-project-detail.png");
    const taskLink = page.locator('a[href*="/tasks/"]').first();
    if (await taskLink.count()) {
      await taskLink.click();
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(out, "05-field-task-entry.png"), fullPage: true });
      console.log("✓ 05-field-task-entry.png");
    }
  }
});

await withUser("manager@frs.local", async (page) => {
  await page.goto(`${base}/approvals`);
  await page.waitForLoadState("networkidle");
  const approvalLink = page.locator('a[href^="/approvals/"]').first();
  if (await approvalLink.count()) {
    const href = await approvalLink.getAttribute("href");
    if (href && !href.includes("history")) {
      await page.goto(`${base}${href}`);
      await page.waitForLoadState("networkidle");
      await page.screenshot({ path: path.join(out, "09-approvals-detail.png"), fullPage: true });
      console.log("✓ 09-approvals-detail.png");
    }
  }
});

await withUser("padmin@frs.local", async (page) => {
  await page.goto(`${base}/office/projects`);
  await page.waitForLoadState("networkidle");
  const jobLink = page.getByRole("link", { name: /JOB-/i }).first();
  if (await jobLink.count()) {
    await jobLink.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: path.join(out, "16-office-project-detail.png"), fullPage: true });
    console.log("✓ 16-office-project-detail.png");
  }
});

await browser.close();
