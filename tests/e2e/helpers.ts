import type { Page } from "@playwright/test";

export function uniqueTestUser() {
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return {
    organizationName: `Test Org ${suffix}`,
    email: `e2e-${suffix}@example.com`,
    password: "TestPassword123!",
  };
}

/** Cree un compte via le formulaire d'inscription et attend l'arrivee sur le dashboard. */
export async function registerAndLogin(page: Page) {
  const user = uniqueTestUser();

  await page.goto("/register");
  await page.getByLabel(/nom de l'entreprise/i).fill(user.organizationName);
  await page.getByLabel(/^email$/i).fill(user.email);
  await page.getByLabel(/mot de passe/i).fill(user.password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: /creer mon compte/i }).click();

  await page.waitForURL("**/dashboard", { timeout: 15_000 });
  return user;
}
