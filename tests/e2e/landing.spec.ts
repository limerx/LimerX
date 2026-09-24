import { test, expect } from "@playwright/test";

test.describe("Page d'accueil", () => {
  test("affiche le titre principal et le lien de connexion", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("NF C15-100");
    await expect(page.getByRole("link", { name: /connexion/i })).toBeVisible();
  });

  test("affiche la carte tarif avec un bouton d'inscription", async ({ page }) => {
    await page.goto("/");
    const pricingCta = page.getByRole("link", { name: /essayer gratuitement/i });
    await expect(pricingCta).toBeVisible();
    await expect(pricingCta).toHaveAttribute("href", "/register");
  });

  test("le footer rappelle que l'IA ne remplace pas un professionnel", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/ne remplace pas l'avis d'un electricien/i)).toBeVisible();
  });
});
