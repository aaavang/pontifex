import { test, expect } from '../fixtures';
import {
  CreateApplicationPage,
  ApplicationDetailPage,
  DashboardPage,
  EnvironmentDetailPage,
} from '../pages';

test.describe.serial('Application Lifecycle', () => {
  const appName = `e2e-lifecycle-${Date.now()}`;
  let appId: string;
  let devEnvId: string;

  test('create application via UI and verify via API', async ({ page, apiClient, cleanup }) => {
    // Create app via UI
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.expectFormVisible();
    await createPage.fillName(appName);
    await createPage.fillDescription('Integration test app');
    await createPage.selectEnvironments('dev');
    await createPage.submit();

    // Should redirect to application detail page
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    const appDetailPage = new ApplicationDetailPage(page);
    await appDetailPage.waitForLoad();

    // Extract app ID from URL
    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    expect(appId).toBeTruthy();

    // Register cleanup immediately
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));

    // API verify: app exists with correct name
    const appBundle = await apiClient.getApplication(appId);
    expect(appBundle.application.name).toBe(appName);
    expect(appBundle.application.description).toBe('Integration test app');
    expect(appBundle.environments).toHaveLength(1);
    expect(appBundle.environments[0].level).toBe('dev');
    expect(appBundle.owners.length).toBeGreaterThanOrEqual(1);

    devEnvId = appBundle.environments[0].id;
  });

  test('add role via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No environment ID from previous test');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);

    const roleName = 'TestRole';
    await envPage.addRole(roleName, { description: 'E2E test role' });
    await envPage.expectRoleVisible(roleName);

    // API verify: role exists on environment
    const envBundle = await apiClient.getEnvironment(devEnvId);
    const role = envBundle.roles.find(r => r.name === roleName);
    expect(role).toBeDefined();
    expect(role!.name).toBe(roleName);
  });

  test('delete application via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!appId, 'No app ID from previous test');

    const appDetailPage = new ApplicationDetailPage(page);
    await appDetailPage.goto(appId);

    // Accept the confirm dialog that deletion triggers
    page.on('dialog', dialog => dialog.accept());
    await appDetailPage.deleteApplication();

    // Wait for redirect back to dashboard
    await page.waitForURL(/\/(dashboard)?$/, { timeout: 30_000 });

    // API verify: app no longer exists
    const result = await apiClient.getApplicationSafe(appId);
    expect(result).toBeNull();
  });
});
