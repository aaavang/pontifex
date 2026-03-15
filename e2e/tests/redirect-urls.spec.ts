import { test, expect } from '../fixtures';
import { CreateApplicationPage, EnvironmentDetailPage } from '../pages';

test.describe.serial('Environment Redirect URLs', () => {
  const appName = `e2e-redirect-${Date.now()}`;
  let appId: string;
  let devEnvId: string;

  test('setup: create application', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(appName);
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));

    const bundle = await apiClient.getApplication(appId);
    devEnvId = bundle.environments[0].id;
  });

  test('add SPA redirect URL via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);

    await envPage.addRedirectUrl('http://localhost:3000/callback');
    await expect(page.getByText('http://localhost:3000/callback')).toBeVisible();

    // API verify
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.environment.spaRedirectUrls).toContain('http://localhost:3000/callback');
  });

  test('add WEB redirect URL via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);

    await envPage.addRedirectUrl('https://example.com/auth/callback', 'WEB');
    await expect(page.getByText('https://example.com/auth/callback')).toBeVisible();

    // API verify
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.environment.webRedirectUrls).toContain('https://example.com/auth/callback');
  });

  test('remove SPA redirect URL via UI and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);

    await envPage.deleteRedirectUrl('http://localhost:3000/callback');

    // API verify
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.environment.spaRedirectUrls).not.toContain('http://localhost:3000/callback');
  });

  test('cleanup: delete app via API', async ({ apiClient }) => {
    if (appId) await apiClient.deleteApplication(appId);
  });
});
