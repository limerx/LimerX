import { test, expect } from "@playwright/test";
import { registerAndLogin } from "./helpers";

// Regression test pour un bug rapporte sur mobile : la barre de saisie du chat se retrouvait
// hors du champ visible (en dessous du viewport, dans le scroll) des que le clavier virtuel
// s'ouvrait. Necessite qu'au moins un domaine soit accessible au compte de test fraichement
// cree (is_public = true sur au moins un domaine, ou acces accorde par ailleurs) - sinon
// le test est ignore plutot que de faire echouer la suite pour une raison hors de son controle.
test.describe("Chat - barre de saisie mobile", () => {
  test("la zone de saisie reste dans le viewport visible", async ({ page }) => {
    await registerAndLogin(page);

    const domainCard = page.locator('a[href^="/dashboard/chat/"]').first();
    const hasDomain = (await domainCard.count()) > 0;
    test.skip(!hasDomain, "Aucun domaine accessible pour ce compte de test (voir README).");

    await domainCard.click();
    await page.waitForURL("**/dashboard/chat/**");

    const input = page.getByPlaceholder(/votre question/i);
    await expect(input).toBeVisible();

    const viewport = page.viewportSize();
    const box = await input.boundingBox();
    expect(box).not.toBeNull();
    if (box && viewport) {
      expect(box.y).toBeGreaterThan(0);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    }
  });
});
