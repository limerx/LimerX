import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

test.describe("Calculateurs - onglets", () => {
  test("les trois outils sont accessibles et affichent des donnees", async ({ page }) => {
    await registerAndLogin(page);

    const domainCard = page.locator('a[href^="/dashboard/chat/"]').first();
    const hasDomain = (await domainCard.count()) > 0;
    test.skip(!hasDomain, "Aucun domaine accessible pour ce compte de test.");

    await domainCard.click();
    await page.waitForURL("**/dashboard/chat/**");
    await page.getByRole("link", { name: /calculateur/i }).click();
    await page.waitForURL("**/calculateur");

    // Onglet 1 : section de cable (actif par defaut)
    await expect(page.getByText(/type de circuit/i)).toBeVisible();

    // Onglet 2 : volumes salle de bain
    await page.getByRole("button", { name: /volumes salle de bain/i }).click();
    await expect(page.getByRole("heading", { name: "Volume 0" })).toBeVisible();
    await expect(page.getByText("IPX7")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Volume cache" })).toBeVisible();

    // Onglet 3 : equipement par piece
    await page.getByRole("button", { name: /equipement par piece/i }).click();
    await expect(page.getByText(/piece du logement/i)).toBeVisible();
    await expect(page.getByText(/equipement minimal - cuisine/i)).toBeVisible();

    await page.getByLabel(/piece du logement/i).selectOption({ label: "Salle de bain" });
    await expect(page.getByText(/equipement minimal - salle de bain/i)).toBeVisible();
  });
});
