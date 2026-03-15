import { test, expect } from '../fixtures';
import { CreateApplicationPage, ApplicationDetailPage } from '../pages';

test.describe.serial('Application Update', () => {
  const appName = `e2e-update-${Date.now()}`;
  let appId: string;

  test('create application with dev environment', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(appName);
    await createPage.fillDescription('Original description');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    appId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete app ${appName}`, () => apiClient.deleteApplication(appId));

    const bundle = await apiClient.getApplication(appId);
    expect(bundle.environments).toHaveLength(1);
    expect(bundle.environments[0].level).toBe('dev');
  });

  test('update description via Update modal and verify via API', async ({ page, apiClient }) => {
    test.skip(!appId, 'No app ID');

    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.openUpdateModal();

    // Update description
    const descTextarea = page.getByRole('dialog').locator('textarea');
    await descTextarea.clear();
    await descTextarea.fill('Updated description from e2e');

    // Save
    await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();

    // Wait for toast
    await expect(page.getByText('Updated Application')).toBeVisible({ timeout: 10_000 });

    // API verify
    const bundle = await apiClient.getApplication(appId);
    expect(bundle.application.description).toBe('Updated description from e2e');
  });

  test('add test environment via Update modal and verify via API', async ({ page, apiClient }) => {
    test.skip(!appId, 'No app ID');

    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.openUpdateModal();

    // Check the 'test' environment checkbox
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('checkbox', { name: 'test' }).check();

    // Save
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Updated Application')).toBeVisible({ timeout: 15_000 });

    // API verify: now has 2 environments
    const bundle = await apiClient.getApplication(appId);
    expect(bundle.environments).toHaveLength(2);
    const levels = bundle.environments.map(e => e.level).sort();
    expect(levels).toEqual(['dev', 'test']);
  });

  test('cleanup: delete app via API', async ({ apiClient }) => {
    if (appId) await apiClient.deleteApplication(appId);
  });
});
