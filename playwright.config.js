// Pruebas de la app en un navegador con tamaño de teléfono. Uso: npm test
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'tests',
  testMatch: '*.spec.js',
  timeout: 60000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:8765',
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    // En entornos con Chromium ya instalado se puede indicar su ruta
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: 'npx http-server -p 8765 -s -c-1 .',
    url: 'http://localhost:8765/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
