import { defineConfig, devices } from "@playwright/test";

// L'app doit deja tourner (npm run dev) avec une base migree - voir README, section Tests.
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
    // Si le paquet @playwright/test installe (package.json) est plus recent que les
    // navigateurs pre-installes de l'environnement, forcer ce chemin evite un
    // telechargement / une erreur de revision manquante. A retirer si l'environnement
    // d'execution a ses propres navigateurs Playwright installes via `npx playwright install`.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : undefined,
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Vise specifiquement les regressions mobiles (ex: barre de saisie du chat hors champ).
      // Emulation Chromium (Pixel 5) plutot que WebKit : reutilise le meme moteur/navigateur
      // que le projet desktop, pas besoin d'installer un binaire supplementaire.
      name: "mobile-chromium",
      use: { ...devices["Pixel 5"] },
    },
  ],
});
