import { test, expect } from '../fixtures';
import {
  CreateApplicationPage,
  ApplicationDetailPage,
  EnvironmentDetailPage,
} from '../pages';

test.describe.serial('Environment Management', () => {
  const appName = `e2e-envmgmt-${Date.now()}`;
  let appId: string;
  let devEnvId: string;

  test.beforeAll(async ({ browser }) => {
    // We cannot use fixtures in beforeAll, so the first test creates the app
  });

  test('setup: create application with dev environment', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(appName);
    await createPage.fillDescription('Environment management test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();

    await page.waitForURL(/\/applications\//, { timeout: 30_000 });

    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    expect(appId).toBeTruthy();

    // Register cleanup for the entire suite
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));

    const appBundle = await apiClient.getApplication(appId);
    devEnvId = appBundle.environments[0].id;
  });

  test('add role via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No environment ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);
    // goto() calls waitForLoad() internally

    await envPage.addRole('Reader', { description: 'Read-only access' });
    await envPage.expectRoleVisible('Reader');

    // API verify
    const envBundle = await apiClient.getEnvironment(devEnvId);
    const role = envBundle.roles.find(r => r.name === 'Reader');
    expect(role).toBeDefined();
  });

  test('add scope via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No environment ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);
    // goto() calls waitForLoad() internally

    await envPage.addScope('read:data', 'Read Data', 'Allows reading data');
    await envPage.expectScopeVisible('read:data');

    // API verify
    const envBundle = await apiClient.getEnvironment(devEnvId);
    const scope = envBundle.scopes.find(s => s.name === 'read:data');
    expect(scope).toBeDefined();
  });

  test('create client credential via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No environment ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);
    // goto() calls waitForLoad() internally

    await envPage.createClientCredential();

    // API verify: password exists on environment
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.passwords.length).toBeGreaterThanOrEqual(1);
  });

  test('cleanup: delete application via API', async ({ apiClient }) => {
    test.skip(!appId, 'No app ID');
    await apiClient.deleteApplication(appId);

    const result = await apiClient.getApplicationSafe(appId);
    expect(result).toBeNull();
  });
});
