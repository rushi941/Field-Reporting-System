#!/usr/bin/env node
/**
 * Capture page screenshots for docs/frs-project-flow-guide.html
 * Requires: npm run dev (web + api) or playwright webServer
 */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "docs", "screenshots");
const baseURL = process.env.FRS_WEB_URL ?? "http://localhost:5174";
const password = "ChangeMe123!";

const users = {
  systemAdmin: "admin@frs.local",
  projectAdmin: "padmin@frs.local",
  manager: "manager@frs.local",
  fieldLead: "lead@frs.local",
};

async function login(page, email) {
  await page.goto(`${baseURL}/login`);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 45_000,
  });
  await page.waitForLoadState("networkidle");
}

async function shot(page, file, url, waitMs = 800) {
  await page.goto(`${baseURL}${url}`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(waitMs);
  const filePath = path.join(outDir, file);
  await page.screenshot({ path: filePath, fullPage: true });
  console.log(`  ✓ ${file}`);
  return file;
}

async function firstHref(page, selector) {
  const el = page.locator(selector).first();
  if ((await el.count()) === 0) return null;
  const href = await el.getAttribute("href");
  return href;
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const manifest = [];

  const browser = await chromium.launch();

  async function withRole(email, fn) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await login(page, email);
    await fn(page);
    await ctx.close();
  }

  // Login page (no auth)
  {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await ctx.newPage();
    await page.goto(`${baseURL}/login`);
    await page.waitForLoadState("networkidle");
    await page.screenshot({
      path: path.join(outDir, "01-login.png"),
      fullPage: true,
    });
    manifest.push({ id: "login", file: "01-login.png", role: "Public", route: "/login" });
    console.log("  ✓ 01-login.png");
    await ctx.close();
  }

  // Field Lead
  await withRole(users.fieldLead, async (page) => {
    manifest.push(
      { id: "field-projects", file: await shot(page, "02-field-projects.png", "/field/projects"), role: "Field Lead", route: "/field/projects" },
      { id: "field-reports", file: await shot(page, "03-field-reports.png", "/field/reports"), role: "Field Lead", route: "/field/reports" },
    );
    const projectLink = await firstHref(page, 'a[href*="/field/projects/"]');
    if (projectLink) {
      manifest.push({
        id: "field-project-detail",
        file: await shot(page, "04-field-project-detail.png", projectLink),
        role: "Field Lead",
        route: projectLink,
      });
      await page.goto(`${baseURL}${projectLink}`);
      await page.waitForLoadState("networkidle");
      const taskLink = await firstHref(page, 'a[href*="/tasks/"]');
      if (taskLink) {
        manifest.push({
          id: "field-task-entry",
          file: await shot(page, "05-field-task-entry.png", taskLink),
          role: "Field Lead",
          route: taskLink,
        });
      }
    }
    await page.goto(`${baseURL}/field/reports`);
    await page.waitForLoadState("networkidle");
    const reportLink = await firstHref(page, 'a[href*="/field/reports/"]');
    if (reportLink) {
      manifest.push({
        id: "field-report-detail",
        file: await shot(page, "06-field-report-detail.png", reportLink),
        role: "Field Lead",
        route: reportLink,
      });
    }
  });

  // Manager
  await withRole(users.manager, async (page) => {
    manifest.push(
      { id: "approvals-queue", file: await shot(page, "07-approvals-queue.png", "/approvals"), role: "Division Manager", route: "/approvals" },
      { id: "approvals-history", file: await shot(page, "08-approvals-history.png", "/approvals/history"), role: "Division Manager", route: "/approvals/history" },
    );
    const approvalLink = await firstHref(page, 'a[href^="/approvals/"]');
    if (approvalLink && !approvalLink.includes("history")) {
      manifest.push({
        id: "approvals-detail",
        file: await shot(page, "09-approvals-detail.png", approvalLink),
        role: "Division Manager",
        route: approvalLink,
      });
    }
  });

  // Project Admin
  await withRole(users.projectAdmin, async (page) => {
    const officePages = [
      ["10-office-overview.png", "/office", "office-overview"],
      ["11-office-projects.png", "/office/projects", "office-projects"],
      ["12-office-project-types.png", "/office/project-types", "office-project-types"],
      ["13-office-units.png", "/office/units", "office-units"],
      ["14-office-bids.png", "/office/bids", "office-bids"],
      ["15-office-billing.png", "/office/billing", "office-billing"],
    ];
    for (const [file, route, id] of officePages) {
      manifest.push({
        id,
        file: await shot(page, file, route),
        role: "Project Admin",
        route,
      });
    }
    await page.goto(`${baseURL}/office/projects`);
    await page.waitForLoadState("networkidle");
    const officeProject = await firstHref(page, 'a[href*="/office/projects/"]');
    if (officeProject) {
      manifest.push({
        id: "office-project-detail",
        file: await shot(page, "16-office-project-detail.png", officeProject),
        role: "Project Admin",
        route: officeProject,
      });
    }
    await page.goto(`${baseURL}/office/billing`);
    await page.waitForLoadState("networkidle");
    const billingLink = await firstHref(page, 'a[href*="/office/billing/"]');
    if (billingLink) {
      manifest.push({
        id: "office-billing-drilldown",
        file: await shot(page, "17-office-billing-drilldown.png", billingLink),
        role: "Project Admin",
        route: billingLink,
      });
    }
  });

  // System Admin
  await withRole(users.systemAdmin, async (page) => {
    manifest.push(
      { id: "system-overview", file: await shot(page, "18-system-overview.png", "/system"), role: "System Admin", route: "/system" },
      { id: "system-users", file: await shot(page, "19-system-users.png", "/system/users"), role: "System Admin", route: "/system/users" },
      { id: "system-permissions", file: await shot(page, "20-system-permissions.png", "/system/permissions"), role: "System Admin", route: "/system/permissions" },
    );
  });

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
  );

  await browser.close();
  console.log(`\nCaptured ${manifest.length} screenshots → docs/screenshots/`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
