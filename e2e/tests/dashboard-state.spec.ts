import { test, expect } from '../fixtures';
import { CreateApplicationPage, DashboardPage } from '../pages';

test.describe.serial('Dashboard State', () => {
  const appName = `e2e-dash-${Date.now()}`;
  let appId: string;

  test('create application', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(appName);
    await createPage.fillDescription('Dashboard state test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));
  });

  test('app appears on dashboard and matches API owned applications', async ({ page, apiClient }) => {
    test.skip(!appId, 'No app ID');

    // Check dashboard UI
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
    await expect(page.getByText(appName)).toBeVisible({ timeout: 10_000 });

    // API verify: owned apps list includes this app
    const ownedApps = await apiClient.getOwnedApplications();
    const found = ownedApps.applications.find(a => a.id === appId);
    expect(found).toBeDefined();
    expect(found!.name).toBe(appName);
  });

  test('current user API shows correct user info', async ({ apiClient }) => {
    const userResult = await apiClient.getCurrentUser();
    expect(userResult.bundle).toBeDefined();
    expect(userResult.bundle.user).toBeDefined();
    expect(userResult.bundle.user.email).toBeTruthy();
  });

  test('delete app and verify it disappears from dashboard', async ({ page, apiClient }) => {
    test.skip(!appId, 'No app ID');

    // Delete via API
    await apiClient.deleteApplication(appId);

    // Verify dashboard no longer shows it
    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // The app name should no longer be visible (give time for data to update)
    await page.waitForTimeout(2_000);
    await expect(page.getByText(appName)).not.toBeVisible({ timeout: 5_000 });
  });
});
