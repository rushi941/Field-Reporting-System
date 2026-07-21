import { test as base } from "@playwright/test";
import { loginAs, TEST_USERS } from "./auth";

type RoleFixtures = {
  adminPage: void;
  projectAdminPage: void;
  managerPage: void;
  fieldLeadPage: void;
};

export const test = base.extend<RoleFixtures>({
  adminPage: async ({ page }, use) => {
    await loginAs(page, TEST_USERS.systemAdmin);
    await use();
  },
  projectAdminPage: async ({ page }, use) => {
    await loginAs(page, TEST_USERS.projectAdmin);
    await use();
  },
  managerPage: async ({ page }, use) => {
    await loginAs(page, TEST_USERS.manager);
    await use();
  },
  fieldLeadPage: async ({ page }, use) => {
    await loginAs(page, TEST_USERS.fieldLead);
    await use();
  },
});

export { expect } from "@playwright/test";
