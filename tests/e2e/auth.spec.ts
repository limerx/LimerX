import { test, expect } from "@playwright/test";
import { registerAndLogin, uniqueTestUser } from "./helpers";

test.describe("Inscription et connexion", () => {
  test("creer un compte redirige vers le dashboard", async ({ page }) => {
    await registerAndLogin(page);
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(/vos domaines de connaissance/i)).toBeVisible();
  });

  test("le formulaire d'inscription refuse de soumettre sans accepter le rappel legal", async ({
    page,
  }) => {
    const user = uniqueTestUser();
    await page.goto("/register");
    await page.getByLabel(/nom de l'entreprise/i).fill(user.organizationName);
    await page.getByLabel(/^email$/i).fill(user.email);
    await page.getByLabel(/mot de passe/i).fill(user.password);
    // Case a cocher volontairement non cochee.
    await page.getByRole("button", { name: /creer mon compte/i }).click();
    // La validation HTML native du champ requis bloque la soumission : on reste sur /register.
    await expect(page).toHaveURL(/\/register$/);
  });

  test("se reconnecter avec un mauvais mot de passe affiche une erreur", async ({ page }) => {
    const user = await registerAndLogin(page);
    await page.goto("/login");
    await page.getByLabel(/^email$/i).fill(user.email);
    await page.getByLabel(/mot de passe/i).fill("MauvaisMotDePasse!");
    await page.getByRole("button", { name: /se connecter/i }).click();
    await expect(page.getByText(/email ou mot de passe incorrect/i)).toBeVisible();
  });
});
