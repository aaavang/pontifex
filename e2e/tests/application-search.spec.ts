import { test, expect } from '../fixtures';
import { CreateApplicationPage } from '../pages';

test.describe.serial('Application Search', () => {
  // Use a unique prefix to avoid collisions
  const prefix = `e2e-srch-${Date.now()}`;
  const appName = `${prefix}-findme`;
  let appId: string;

  test('create application', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(appName);
    await createPage.fillDescription('Searchable test app');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));
  });

  test('search by prefix returns the app via API', async ({ apiClient }) => {
    test.skip(!appId, 'No app ID');

    const result = await apiClient.searchApplications(prefix);
    expect(result.applications).toBeDefined();
    const found = result.applications.find(a => a.name === appName);
    expect(found).toBeDefined();
    expect(found!.id).toBe(appId);
  });

  test('search with non-matching prefix returns empty', async ({ apiClient }) => {
    const result = await apiClient.searchApplications(`nonexistent-${Date.now()}`);
    expect(result.applications).toHaveLength(0);
  });

  test('owned applications includes the app via API', async ({ apiClient }) => {
    test.skip(!appId, 'No app ID');

    const result = await apiClient.getOwnedApplications();
    const found = result.applications.find(a => a.id === appId);
    expect(found).toBeDefined();
  });

  test('cleanup: delete app via API', async ({ apiClient }) => {
    if (appId) await apiClient.deleteApplication(appId);
  });
});
