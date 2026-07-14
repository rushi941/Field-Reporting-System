/**
 * Live E2E against Vite (:5174) + API (via /api proxy).
 * Flow: Field submit → Manager approve / return → Field sees manager → Admin billing
 */
import { chromium } from "playwright";

const BASE = process.env.FRS_WEB_URL ?? "http://localhost:5174";
const PASS = "ChangeMe123!";

/** @param {import('playwright').Page} page */
async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.locator("#email").waitFor({ timeout: 10000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASS);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 15000,
  });
}

/** @param {import('playwright').Page} page */
async function logout(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE}/login`);
  await page.locator("#email").waitFor({ timeout: 10000 });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  /** @type {string[]} */
  const log = [];
  const step = (s) => {
    log.push(`✓ ${s}`);
    console.log(`✓ ${s}`);
  };

  try {
    // ── 1) Field Lead: open project, enter task, submit ────────────────
    await login(page, "lead@frs.local");
    step(`Field lead logged in → ${page.url()}`);

    await page.goto(`${BASE}/field/projects`);
    await page.waitForSelector("text=JOB-", { timeout: 15000 });
    await page.getByText(/JOB-/).first().click();
    await page.waitForURL("**/field/projects/**", { timeout: 10000 });
    step("Opened project from list");

    const taskBtn = page.locator("ul li button").first();
    await taskBtn.waitFor({ timeout: 10000 });
    const taskLabel = (await taskBtn.innerText())
      .replace(/\s+/g, " ")
      .slice(0, 80);
    await taskBtn.click();
    await page.waitForURL("**/tasks/**", { timeout: 10000 });
    step(`Opened task entry: ${taskLabel}`);

    await page.getByText(/Loading task/i).waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
    await page.getByRole("button", { name: /submit for approval/i }).waitFor({
      timeout: 20000,
    });

    const begin = page.getByPlaceholder(/1\+00|142/i).or(page.getByLabel(/begin sta/i));
    const loc = page.getByPlaceholder(/STA 12\+50/i);
    if (await begin.first().isVisible().catch(() => false)) {
      await page.locator("#begin-0").fill("110+00");
      await page.locator("#end-0").fill("112+00");
      step("Filled STA range 110+00 → 112+00");
    } else if (await loc.isVisible().catch(() => false)) {
      await page.locator("#loc-0").fill("STA 20+00 NB ramp (E2E)");
      await page.locator("#sym-0").fill("Arrow E2E");
      await page.locator("#qty-0").fill("3");
      step("Filled single location quantity");
    } else {
      throw new Error("Unknown task form — no STA or location fields");
    }

    await page.getByRole("button", { name: /submit for approval/i }).click();
    await page.waitForURL("**/field/reports**", { timeout: 20000 });
    step("Submitted report for approval");

    await page.goto(`${BASE}/field/reports`);
    await page.waitForSelector("text=/R-\\d{8}-\\d+/", { timeout: 10000 });
    assert(
      await page
        .getByText(/under review/i)
        .first()
        .isVisible()
        .catch(() => false),
      "Expected Under review status after submit",
    );
    step("Field reports list shows Under review");

    await logout(page);

    // ── 2) Manager: approve ────────────────────────────────────────────
    await login(page, "manager@frs.local");
    step(`Manager logged in → ${page.url()}`);

    await page.goto(`${BASE}/approvals`);
    await page.getByRole("heading", { name: /pending approval/i }).waitFor({
      timeout: 15000,
    });
    const firstPending = page.locator('a[href^="/approvals/"]').first();
    await firstPending.waitFor({ timeout: 15000 });
    await firstPending.click();
    await page.waitForURL(/\/approvals\/.+/, { timeout: 10000 });
    step("Opened pending report detail");

    await page.getByRole("button", { name: /^approve$/i }).click();
    await page.waitForURL("**/approvals", { timeout: 15000 });
    step("Manager approved report");

    await logout(page);

    // ── 3) Field Lead: Approved by manager ─────────────────────────────
    await login(page, "lead@frs.local");
    await page.goto(`${BASE}/field/reports`);
    await page.waitForSelector("text=/Approved by/i", { timeout: 15000 });
    const approvedBy = await page
      .getByText(/Approved by /i)
      .first()
      .innerText();
    step(`Field lead sees: ${approvedBy}`);
    assert(/Approved by .+/i.test(approvedBy), "Missing approver name");

    await page.getByText(/Approved by /i).first().click();
    await page.waitForURL("**/field/reports/**", { timeout: 10000 });
    await page.getByText(/Approved by /i).first().waitFor({ timeout: 10000 });
    step("Field lead opened approved report detail");

    await logout(page);

    // ── 4) Return path ─────────────────────────────────────────────────
    await login(page, "lead@frs.local");
    await page.goto(`${BASE}/field/projects`);
    await page.getByText(/JOB-/).first().click();
    await page.waitForURL("**/field/projects/**");

    const dateInput = page.locator('input[type="date"]');
    if (await dateInput.isVisible().catch(() => false)) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      await dateInput.fill(iso);
      await page.waitForTimeout(1000);
      step(`Set report date ${iso} for return-path draft`);
    }

    await page.locator("ul li button").nth(0).click();
    await page.waitForURL("**/tasks/**");
    await page.getByText(/Loading task/i).waitFor({ state: "hidden", timeout: 20000 }).catch(() => {});
    await page.getByRole("button", { name: /submit for approval/i }).waitFor({
      timeout: 20000,
    });
    if (await page.locator("#begin-0").isVisible().catch(() => false)) {
      await page.locator("#begin-0").fill("200+00");
      await page.locator("#end-0").fill("201+00");
    } else {
      await page.locator("#loc-0").fill("Return path loc");
      await page.locator("#sym-0").fill("Symbol");
      await page.locator("#qty-0").fill("1");
    }
    await page.getByRole("button", { name: /submit for approval/i }).click();
    await page.waitForURL("**/field/reports**", { timeout: 20000 });
    step("Second report submitted for return path");
    await logout(page);

    await login(page, "manager@frs.local");
    await page.goto(`${BASE}/approvals`);
    await page.locator('a[href*="/approvals/"]').first().click();
    await page.waitForURL("**/approvals/**");
    await page.getByRole("button", { name: /^return$/i }).click();
    await page.getByLabel(/return comment/i).fill("E2E: fix quantity notes");
    await page.getByRole("button", { name: /send back to field lead/i }).click();
    await page.waitForURL("**/approvals", { timeout: 15000 });
    step("Manager returned report with comment");
    await logout(page);

    await login(page, "lead@frs.local");
    await page.goto(`${BASE}/field/reports`);
    await page.waitForSelector("text=/Returned by/i", { timeout: 15000 });
    const returnedBy = await page
      .getByText(/Returned by /i)
      .first()
      .innerText();
    step(`Field lead sees: ${returnedBy}`);
    await page.getByText(/E2E: fix quantity notes/i).first().waitFor({
      timeout: 5000,
    });
    step("Return comment visible on list");
    await logout(page);

    // ── 5) Project Admin billing ───────────────────────────────────────
    await login(page, "padmin@frs.local");
    step(`Project admin logged in → ${page.url()}`);
    await page.goto(`${BASE}/office/billing`);
    await page.waitForSelector("text=Billing", { timeout: 15000 });
    await page.getByText(/JOB-/).first().waitFor({ timeout: 10000 });
    step("Billing rollup loaded with projects");

    const drill = page.getByRole("link", { name: /drilldown/i }).first();
    if (await drill.isVisible().catch(() => false)) {
      await drill.click();
      await page.waitForURL("**/billing/**", { timeout: 10000 });
      await page.getByText(/Approved quantities/i).waitFor({ timeout: 10000 });
      step("Billing drilldown shows approved quantities");
    }

    console.log("\n=== LIVE E2E PASSED ===");
    console.log(log.join("\n"));
  } catch (err) {
    const shot = "e2e-failure.png";
    await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
    console.error("\n=== LIVE E2E FAILED ===");
    console.error(err);
    console.error(`Screenshot: ${shot}`);
    console.error("Steps before failure:\n" + log.join("\n"));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
