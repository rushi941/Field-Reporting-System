/**
 * Smoke test: login → system projects → units → create-task UI loads
 */
import { chromium } from "playwright";

const BASE = process.env.FRS_WEB_URL ?? "http://localhost:5174";
const EMAIL = "admin@frs.local";
const PASS = "ChangeMe123!";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];

  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  console.log(`Opening ${BASE}/login`);
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASS);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), {
    timeout: 20000,
  });
  console.log(`Logged in → ${page.url()}`);

  await page.goto(`${BASE}/system/projects`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Projects" }).waitFor({ timeout: 15000 });
  console.log("Projects page OK");

  await page.goto(`${BASE}/system/units`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Units" }).waitFor({ timeout: 15000 });
  const unitRows = await page.locator("table tbody tr").count();
  console.log(`Units page OK (${unitRows} rows)`);
  if (unitRows < 1) throw new Error("Expected unit master rows");

  // Open first project detail if any
  await page.goto(`${BASE}/system/projects`, { waitUntil: "networkidle" });
  const firstRow = page.locator("table tbody tr").first();
  if ((await firstRow.count()) > 0) {
    await firstRow.click();
    await page.waitForURL(/\/system\/projects\//, { timeout: 15000 });
    await page.getByRole("button", { name: /add task/i }).click();
    const modal = page.locator("#project-task-form-modal");
    await modal.waitFor({ timeout: 10000 });
    await modal.getByText("Unit", { exact: true }).waitFor({ timeout: 10000 });
    const unitOptions = await modal
      .locator("select")
      .filter({ hasText: "LF" })
      .locator("option")
      .count();
    console.log(`Create task modal OK (unit options: ${unitOptions})`);
    if (unitOptions < 1) throw new Error("Unit dropdown empty");
    await modal.getByRole("button", { name: /cancel/i }).click();
  } else {
    console.log("No projects — skipped create-task check");
  }

  const fatal = errors.filter(
    (e) =>
      !e.includes("favicon") &&
      !e.includes("Download the React DevTools"),
  );
  if (fatal.length) {
    console.error("Browser errors:\n" + fatal.join("\n"));
    throw new Error(`${fatal.length} browser error(s)`);
  }

  console.log("SMOKE PASS");
  await browser.close();
}

main().catch(async (err) => {
  console.error("SMOKE FAIL:", err.message ?? err);
  process.exit(1);
});
