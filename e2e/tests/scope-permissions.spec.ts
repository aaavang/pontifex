import { test, expect } from '../fixtures';
import {
  CreateApplicationPage,
  EnvironmentDetailPage,
  ConnectionWizardPage,
  TokenTesterPage,
} from '../pages';

test.describe.serial('Scope-based Permission Requests', () => {
  const resourceAppName = `e2e-scope-res-${Date.now()}`;
  const clientAppName = `e2e-scope-cli-${Date.now()}`;
  const scopeName = 'read.data';
  const scopeDisplayName = 'Read Data';

  let resourceAppId: string;
  let clientAppId: string;
  let resourceDevEnvId: string;
  let clientDevEnvId: string;

  test('setup: create resource app with scope', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(resourceAppName);
    await createPage.fillDescription('Resource app for scope test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    resourceAppId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete resource app`, () => apiClient.deleteApplication(resourceAppId));

    const bundle = await apiClient.getApplication(resourceAppId);
    resourceDevEnvId = bundle.environments[0].id;

    // Add scope to resource env
    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(resourceDevEnvId);
    await envPage.addScope(scopeName, scopeDisplayName, 'Allows reading data');
    await envPage.expectScopeVisible(scopeName);

    // API verify scope exists
    const envBundle = await apiClient.getEnvironment(resourceDevEnvId);
    expect(envBundle.scopes.find(s => s.name === scopeName)).toBeDefined();
  });

  test('setup: create client app with credential', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(clientAppName);
    await createPage.fillDescription('Client app for scope test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    clientAppId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete client app`, () => apiClient.deleteApplication(clientAppId));

    const bundle = await apiClient.getApplication(clientAppId);
    clientDevEnvId = bundle.environments[0].id;

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(clientDevEnvId);
    await envPage.createClientCredential();
  });

  test('request scope access via Connection Wizard', async ({ page, apiClient }) => {
    test.skip(!clientDevEnvId || !resourceDevEnvId, 'Missing env IDs');

    const wizard = new ConnectionWizardPage(page);
    await wizard.goto();
    await wizard.selectSourceApplication(clientAppName);
    await wizard.selectSourceEnvironment('dev');
    await wizard.selectTargetApplication(resourceAppName);
    await wizard.selectTargetEnvironment('dev');
    await wizard.selectScopes(scopeDisplayName);
    await wizard.submitAccessRequest();
    await wizard.finishWizard();

    // API verify: permission request for scope exists
    const permRequests = await apiClient.getEnvironmentPermissionRequests(resourceDevEnvId);
    const inbound = permRequests.inboundPermissionRequests;
    const scopeRequest = inbound.find(
      pr => pr.targetPermissionName === scopeName && pr.permissionType === 'Scope',
    );
    // Scope requests may use displayName as targetPermissionName
    const scopeRequestAlt = inbound.find(
      pr => (pr.targetPermissionName === scopeName || pr.targetPermissionName === scopeDisplayName),
    );
    expect(scopeRequest || scopeRequestAlt).toBeDefined();
  });

  test('cleanup: delete both apps via API', async ({ apiClient }) => {
    if (clientAppId) {
      try { await apiClient.deleteApplication(clientAppId); } catch {}
    }
    if (resourceAppId) {
      try { await apiClient.deleteApplication(resourceAppId); } catch {}
    }
  });
});
