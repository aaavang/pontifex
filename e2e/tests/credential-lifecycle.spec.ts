import { test, expect } from '../fixtures';
import { CreateApplicationPage, EnvironmentDetailPage } from '../pages';

test.describe.serial('Client Credential Lifecycle', () => {
  const appName = `e2e-cred-${Date.now()}`;
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

  test('create first client credential and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);
    await envPage.createClientCredential();

    // API verify
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.passwords).toHaveLength(1);
  });

  test('create second client credential and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);
    await envPage.createClientCredential();

    // API verify: now has 2 credentials
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.passwords).toHaveLength(2);
  });

  test('delete a client credential and verify via API', async ({ page, apiClient }) => {
    test.skip(!devEnvId, 'No env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(devEnvId);
    await envPage.deleteClientCredential();

    // API verify: back to 1 credential
    const envBundle = await apiClient.getEnvironment(devEnvId);
    expect(envBundle.passwords).toHaveLength(1);
  });

  test('cleanup: delete app via API', async ({ apiClient }) => {
    if (appId) await apiClient.deleteApplication(appId);
  });
});
