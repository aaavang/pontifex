import { test as base } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const sessionStorageFile = path.join(__dirname, '.auth', 'session-storage.json');

export const test = base.extend({
  page: async ({ page }, use) => {
    // Restore MSAL sessionStorage before navigating to the app
    if (fs.existsSync(sessionStorageFile)) {
      const sessionStorage = JSON.parse(fs.readFileSync(sessionStorageFile, 'utf-8'));

      await page.addInitScript((entries) => {
        for (const [key, value] of Object.entries(entries)) {
          window.sessionStorage.setItem(key, value as string);
        }
      }, sessionStorage);
    }

    await use(page);
  },
});

export { expect } from '@playwright/test';
