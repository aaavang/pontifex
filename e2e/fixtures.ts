import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { PontifexApiClient } from './helpers/api-client';
import { CleanupRegistry } from './helpers/cleanup';

const authDir = path.join(__dirname, '.auth');
const sessionStorageFile = path.join(authDir, 'session-storage.json');

function extractMsalAccessToken(sessionStorage: Record<string, string>): string {
  // MSAL stores access tokens under keys containing "accesstoken"
  for (const [key, value] of Object.entries(sessionStorage)) {
    if (key.toLowerCase().includes('accesstoken')) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.secret) {
          return parsed.secret;
        }
      } catch {
        // not JSON, skip
      }
    }
  }
  throw new Error('Could not extract MSAL access token from session storage');
}

type IntegrationFixtures = {
  apiClient: PontifexApiClient;
  cleanup: CleanupRegistry;
};

export const test = base.extend<IntegrationFixtures>({
  page: async ({ page }, use) => {
    // Restore MSAL sessionStorage before navigating
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

  apiClient: async ({ playwright }, use) => {
    if (!fs.existsSync(sessionStorageFile)) {
      throw new Error('Session storage file not found. Run auth setup first.');
    }

    const sessionStorage = JSON.parse(fs.readFileSync(sessionStorageFile, 'utf-8'));
    const token = extractMsalAccessToken(sessionStorage);

    const requestContext = await playwright.request.newContext({
      ignoreHTTPSErrors: true,
    });

    const client = new PontifexApiClient(requestContext, token);
    await use(client);

    await requestContext.dispose();
  },

  cleanup: async ({}, use) => {
    const registry = new CleanupRegistry();
    await use(registry);
    await registry.runAll();
  },
});

export { expect } from '@playwright/test';
