import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import * as OTPAuth from 'otpauth';

const authDir = path.join(__dirname, '.auth');
const storageStateFile = path.join(authDir, 'user.json');
const sessionStorageFile = path.join(authDir, 'session-storage.json');

setup('authenticate via Azure AD', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  const totpSecret = process.env.TEST_USER_TOTP_SECRET;

  if (!email || !password) {
    throw new Error('TEST_USER_EMAIL and TEST_USER_PASSWORD must be set in ui/.env.test');
  }

  fs.mkdirSync(authDir, { recursive: true });

  await page.goto('/');

  // Azure AD login flow
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByRole('button', { name: /next/i }).click();

  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Handle MFA TOTP prompt if it appears
  if (totpSecret) {
    const codeInput = page.getByPlaceholder(/code/i);
    const visible = await codeInput.isVisible({ timeout: 5_000 }).catch(() => false);

    if (visible) {
      const totp = new OTPAuth.TOTP({
        secret: OTPAuth.Secret.fromBase32(totpSecret.toUpperCase()),
        digits: 6,
        period: 30,
      });
      const code = totp.generate();
      await codeInput.fill(code);
      await page.getByRole('button', { name: /verify/i }).click();
    }
  }

  // Handle "Stay signed in?" prompt
  const staySignedIn = page.getByRole('button', { name: /yes/i });
  await staySignedIn.waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {});
  if (await staySignedIn.isVisible()) {
    await staySignedIn.click();
  }

  await page.waitForURL(/app\.pontifex\.localhost/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Welcome to Pontifex!' })).toBeVisible({ timeout: 15_000 });

  // Save cookies + localStorage
  await page.context().storageState({ path: storageStateFile });

  // Save sessionStorage (MSAL stores tokens here)
  const sessionStorage = await page.evaluate(() => {
    const entries: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)!;
      entries[key] = window.sessionStorage.getItem(key)!;
    }
    return entries;
  });
  fs.writeFileSync(sessionStorageFile, JSON.stringify(sessionStorage, null, 2));
});
