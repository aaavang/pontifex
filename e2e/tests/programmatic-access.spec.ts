import { test, expect } from '../fixtures';
import { PontifexApiClient } from '../helpers/api-client';

/**
 * Real E2E test: Programmatic Access lifecycle
 *
 * Tests the full flow of a service principal authenticating via client credentials
 * and managing Pontifex resources programmatically.
 *
 * Flow:
 *   1. Human user creates an application with the ProgrammaticAccess role
 *   2. Human user creates a client credential on the app's environment
 *   3. Service principal authenticates via client credentials grant
 *   4. Service principal creates additional Pontifex resources (apps, groups)
 *   5. Service principal can only access resources it owns
 *   6. Everything is cleaned up
 *
 * Prerequisites:
 *   - Full stack running (docker compose up)
 *   - Auth setup completed (user logged in via Azure AD)
 *   - PONTIFEX_CLIENT_ID env var set (the Pontifex app's client ID for audience)
 *   - PONTIFEX_TENANT_ID env var set
 *
 * Environment variables:
 *   - API_BASE_URL: Pontifex API base URL (default: https://api.pontifex.localhost:8443/api)
 *   - PONTIFEX_TENANT_ID: Azure AD tenant ID
 *   - PONTIFEX_CLIENT_ID: The Pontifex app's client ID (used as audience for token requests)
 */

const API_BASE_URL = process.env.API_BASE_URL ?? 'https://api.pontifex.localhost:8443/api';
const PONTIFEX_TENANT_ID = process.env.PONTIFEX_TENANT_ID;
const PONTIFEX_CLIENT_ID = process.env.PONTIFEX_CLIENT_ID;

/** Acquire an Azure AD access token using the client credentials grant. */
async function acquireClientCredentialsToken(
  playwright: any,
  tenantId: string,
  clientId: string,
  clientSecret: string,
  audience: string,
): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const requestContext = await playwright.request.newContext();
  try {
    const response = await requestContext.post(tokenUrl, {
      form: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: `${audience}/.default`,
      },
    });

    if (!response.ok()) {
      const body = await response.text();
      throw new Error(`Token request failed (${response.status()}): ${body}`);
    }

    const body = await response.json();
    if (!body.access_token) {
      throw new Error('Token response missing access_token');
    }

    return body.access_token;
  } finally {
    await requestContext.dispose();
  }
}

test.describe.serial('Programmatic Access — Full E2E', () => {
  const appName = `e2e-programmatic-${Date.now()}`;
  let humanClient: PontifexApiClient;
  let appId: string;
  let devEnvId: string;
  let devEnvClientId: string;
  let clientSecret: string;
  let spToken: string;
  let spClient: PontifexApiClient;
  let spAppId: string;
  let spGroupId: string;

  test.beforeAll(() => {
    test.skip(!PONTIFEX_TENANT_ID, 'PONTIFEX_TENANT_ID not set — skipping programmatic access tests');
    test.skip(!PONTIFEX_CLIENT_ID, 'PONTIFEX_CLIENT_ID not set — skipping programmatic access tests');
  });

  // ── Phase 1: Human user creates the service app ──

  test('human user creates an application with ProgrammaticAccess role', async ({ apiClient, cleanup }) => {
    humanClient = apiClient;

    // Create the application
    const app = await apiClient.createApplication(appName, ['dev'], 'E2E programmatic access test app');
    appId = app.id;
    expect(appId).toBeDefined();

    cleanup.register(`delete programmatic app ${appName}`, async () => {
      try { await humanClient.deleteApplication(appId); } catch { /* best-effort */ }
    });

    // Get the environment details
    const bundle = await apiClient.getApplication(appId);
    expect(bundle.environments).toHaveLength(1);
    devEnvId = bundle.environments[0].id;
    devEnvClientId = bundle.environments[0].clientId;

    // Add ProgrammaticAccess role to the application
    await apiClient.updateApplicationRoles(appId, [
      { displayName: 'ProgrammaticAccess', claimValue: 'ProgrammaticAccess', sensitive: false },
    ]);

    // Verify role was created
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.roles).toHaveLength(1);
    expect(envBundle.roles[0].name).toBe('ProgrammaticAccess');
  });

  test('human user creates a client credential on the environment', async ({ apiClient }) => {
    test.skip(!devEnvId, 'No environment ID from previous test');

    const result = await apiClient.addPassword(devEnvId, 'e2e-programmatic-test-secret');
    expect(result.id).toBeDefined();

    // The password is available in the environment bundle right after creation
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.passwords).toHaveLength(1);

    // Get the actual secret from the create response — it's only available once
    // The API returns the password on creation but not on subsequent reads
    // We need to get it from the AAD response which is stored in the password vertex
    const pw = envBundle.passwords[0];
    clientSecret = pw.password!;
    expect(clientSecret).toBeDefined();
    expect(clientSecret.length).toBeGreaterThan(0);
  });

  // ── Phase 2: Service principal authenticates ──

  test('service principal acquires a token via client credentials', async ({ playwright }) => {
    test.skip(!devEnvClientId || !clientSecret, 'Missing client ID or secret from previous tests');

    spToken = await acquireClientCredentialsToken(
      playwright,
      PONTIFEX_TENANT_ID!,
      devEnvClientId,
      clientSecret,
      PONTIFEX_CLIENT_ID!,
    );

    expect(spToken).toBeDefined();
    expect(spToken.length).toBeGreaterThan(0);
  });

  test('service principal creates an API client and registers itself', async ({ playwright }) => {
    test.skip(!spToken, 'No SP token from previous test');

    const requestContext = await playwright.request.newContext({ ignoreHTTPSErrors: true });
    spClient = new PontifexApiClient(requestContext, spToken);

    // Register the SP as a user in Pontifex (creates the graph vertex)
    const userResult = await spClient.createUser();
    expect(userResult.user).toBeDefined();
    expect(userResult.user.id).toBeDefined();
  });

  // ── Phase 3: Service principal creates resources ──

  test('service principal creates an application', async () => {
    test.skip(!spClient, 'No SP client');

    const spAppName = `e2e-sp-created-${Date.now()}`;
    const app = await spClient.createApplication(spAppName, ['dev']);
    spAppId = app.id;
    expect(spAppId).toBeDefined();
    expect(app.name).toContain('e2e-sp-created');
  });

  test('service principal can read its own application', async () => {
    test.skip(!spClient || !spAppId, 'No SP client or app');

    const bundle = await spClient.getApplication(spAppId);
    expect(bundle.application.id).toBe(spAppId);
    expect(bundle.environments).toHaveLength(1);
    expect(bundle.owners).toHaveLength(1); // SP is the owner
  });

  test('service principal creates a group', async () => {
    test.skip(!spClient, 'No SP client');

    const groupName = `e2e-sp-group-${Date.now()}`;
    const result = await spClient.createGroup(groupName);
    spGroupId = result.group.id;
    expect(spGroupId).toBeDefined();
  });

  test('service principal lists its owned applications', async () => {
    test.skip(!spClient || !spAppId, 'No SP client or app');

    const result = await spClient.getOwnedApplications();
    expect(result.applications.some(a => a.id === spAppId)).toBe(true);
  });

  // ── Phase 4: Ownership enforcement ──

  test('service principal CANNOT access the human user\'s application', async () => {
    test.skip(!spClient || !appId, 'No SP client or human app ID');

    // The SP should be blocked from modifying the human user's app
    const result = await spClient.rawRequest('PATCH', `/applications/${appId}/roles`, {
      roles: [{ displayName: 'Unauthorized', claimValue: 'unauthorized', sensitive: false }],
    });
    expect(result.status).toBe(403);
  });

  test('service principal CANNOT delete the human user\'s application', async () => {
    test.skip(!spClient || !appId, 'No SP client or human app ID');

    const result = await spClient.rawRequest('DELETE', `/applications/${appId}`);
    expect(result.status).toBe(403);
  });

  test('human user CANNOT modify the service principal\'s application', async () => {
    test.skip(!humanClient || !spAppId, 'No human client or SP app ID');

    const result = await humanClient.rawRequest('PATCH', `/applications/${spAppId}/roles`, {
      roles: [{ displayName: 'ShouldFail', claimValue: 'should-fail', sensitive: false }],
    });
    expect(result.status).toBe(403);
  });

  // ── Phase 5: Cleanup ──

  test('service principal cleans up its own resources', async () => {
    if (spClient && spGroupId) {
      await spClient.deleteGroup(spGroupId);
    }
    if (spClient && spAppId) {
      await spClient.deleteApplication(spAppId);
    }
  });

  test('human user cleans up the service app', async () => {
    if (humanClient && appId) {
      await humanClient.deleteApplication(appId);
    }
  });
});
