import { test, expect } from '../fixtures';
import fs from 'fs';
import path from 'path';

const sessionStorageFile = path.join(__dirname, '..', '.auth', 'session-storage.json');

function decodeJwtPayload(token: string): Record<string, any> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
  return JSON.parse(payload);
}

function extractMsalIdToken(sessionStorage: Record<string, string>): string {
  for (const [key, value] of Object.entries(sessionStorage)) {
    if (key.toLowerCase().includes('idtoken')) {
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
  throw new Error('Could not extract MSAL ID token from session storage');
}

test.describe('Admin Token Group', () => {
  test('playwright user ID token contains Admin role from Pontifex_Admins token group', async () => {
    const sessionStorage = JSON.parse(fs.readFileSync(sessionStorageFile, 'utf-8'));
    const idToken = extractMsalIdToken(sessionStorage);
    const payload = decodeJwtPayload(idToken);

    // The ID token should be issued for the Pontifex application
    expect(payload.aud).toBe(process.env.NEXT_PUBLIC_CLIENT_ID ?? 'defb8702-1242-4f85-8d0c-47ad10a87b14');

    // The token should contain a "roles" claim that includes "Admin"
    // This role comes from the Pontifex_Admins group being assigned the Admin app role
    // on the Pontifex application's service principal via the bootstrapped token group
    expect(payload.roles).toBeDefined();
    expect(payload.roles).toContain('Admin');
  });
});
