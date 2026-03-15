import { test, expect } from '../fixtures';
import { CreateApplicationPage, ApplicationDetailPage } from '../pages';

test.describe.serial('Multi-Environment Application', () => {
  const appName = `e2e-multienv-${Date.now()}`;
  let appId: string;

  test('create application with dev and prod environments', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(appName);
    await createPage.fillDescription('Multi-environment test');
    await createPage.selectEnvironments('dev', 'prod');
    await createPage.submit();

    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));

    // API verify: 2 environments at correct levels
    const bundle = await apiClient.getApplication(appId);
    expect(bundle.environments).toHaveLength(2);
    const levels = bundle.environments.map(e => e.level).sort();
    expect(levels).toEqual(['dev', 'prod']);

    // Each environment should have the correct name pattern
    for (const env of bundle.environments) {
      expect(env.name).toContain(appName);
      expect(env.name).toContain(env.level);
      expect(env.clientId).toBeTruthy();
    }
  });

  test('both environments appear on application detail page', async ({ page }) => {
    test.skip(!appId, 'No app ID');

    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.waitForLoad();

    const devLink = await detail.getEnvironmentLink('DEV');
    const prodLink = await detail.getEnvironmentLink('PROD');
    await expect(devLink).toBeVisible();
    await expect(prodLink).toBeVisible();
  });

  test('can navigate to each environment', async ({ page, apiClient }) => {
    test.skip(!appId, 'No app ID');

    const bundle = await apiClient.getApplication(appId);

    for (const env of bundle.environments) {
      await page.goto(`/environments/${env.id}`);
      await page.waitForFunction(
        () => !document.body.textContent?.includes('Loading environment...'),
        { timeout: 10_000 },
      );
      await expect(page.locator('.chakra-card__header .chakra-heading').first()).toBeVisible();
    }
  });

  test('cleanup: delete app via API', async ({ apiClient }) => {
    if (appId) await apiClient.deleteApplication(appId);
  });
});
