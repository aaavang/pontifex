import { test, expect } from '../fixtures';
import {
  CreateApplicationPage,
  ApplicationDetailPage,
  EnvironmentDetailPage,
  ConnectionWizardPage,
  TokenTesterPage,
} from '../pages';

test.describe.serial('Permission Workflow', () => {
  const resourceAppName = `e2e-resource-${Date.now()}`;
  const clientAppName = `e2e-client-${Date.now()}`;
  const roleName = 'Api.Read';

  let resourceAppId: string;
  let clientAppId: string;
  let resourceDevEnvId: string;
  let clientDevEnvId: string;

  test('setup: create resource application', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(resourceAppName);
    await createPage.fillDescription('Resource app for permission test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();

    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    resourceAppId = page.url().split('/applications/')[1].split(/[?#/]/)[0];

    cleanup.register(`delete resource app ${resourceAppName}`, () =>
      apiClient.deleteApplication(resourceAppId),
    );

    const bundle = await apiClient.getApplication(resourceAppId);
    resourceDevEnvId = bundle.environments[0].id;
  });

  test('setup: create client application', async ({ page, apiClient, cleanup }) => {
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(clientAppName);
    await createPage.fillDescription('Client app for permission test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();

    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    clientAppId = page.url().split('/applications/')[1].split(/[?#/]/)[0];

    cleanup.register(`delete client app ${clientAppName}`, () =>
      apiClient.deleteApplication(clientAppId),
    );

    const bundle = await apiClient.getApplication(clientAppId);
    clientDevEnvId = bundle.environments[0].id;
  });

  test('add role to resource app and verify via API', async ({ page, apiClient }) => {
    test.skip(!resourceDevEnvId, 'No resource environment ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(resourceDevEnvId);


    await envPage.addRole(roleName, { description: 'Read access to API' });
    await envPage.expectRoleVisible(roleName);

    // API verify
    const envBundle = await apiClient.getEnvironment(resourceDevEnvId);
    const role = envBundle.roles.find(r => r.name === roleName);
    expect(role).toBeDefined();
  });

  test('create client credential on client app', async ({ page }) => {
    test.skip(!clientDevEnvId, 'No client environment ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(clientDevEnvId);


    await envPage.createClientCredential();
  });

  test('request access via Connection Wizard and verify via API', async ({ page, apiClient }) => {
    test.skip(!clientDevEnvId || !resourceDevEnvId, 'Missing environment IDs');

    const wizard = new ConnectionWizardPage(page);
    await wizard.goto();

    await wizard.selectSourceApplication(clientAppName);
    await wizard.selectSourceEnvironment('dev');
    await wizard.selectTargetApplication(resourceAppName);
    await wizard.selectTargetEnvironment('dev');
    await wizard.selectRoles(roleName);
    await wizard.submitAccessRequest();
    await wizard.finishWizard();

    // API verify: permission request exists on resource environment
    const permRequests = await apiClient.getEnvironmentPermissionRequests(resourceDevEnvId);
    const inbound = permRequests.inboundPermissionRequests;
    const matchingRequest = inbound.find(pr => pr.targetPermissionName === roleName);
    expect(matchingRequest).toBeDefined();
    expect(matchingRequest!.status).toBe('APPROVED');
  });

  test('verify role in token via Token Tester', async ({ page }) => {
    test.skip(!clientDevEnvId, 'No client environment ID');

    const tokenTester = new TokenTesterPage(page);
    await tokenTester.goto(clientDevEnvId);
    await tokenTester.selectCredential(0);
    await tokenTester.waitForToken();
    await tokenTester.expectRoleInToken(roleName);
  });

  test('revoke access via Connection Wizard and verify via API', async ({ page, apiClient }) => {
    test.skip(!clientDevEnvId || !resourceDevEnvId, 'Missing environment IDs');

    // Re-open the wizard to remove the role
    const wizard = new ConnectionWizardPage(page);
    await wizard.goto();

    await wizard.selectSourceApplication(clientAppName);
    await wizard.selectSourceEnvironment('dev');
    await wizard.selectTargetApplication(resourceAppName);
    await wizard.selectTargetEnvironment('dev');
    // Don't select any roles (uncheck all)
    await wizard.submitAccessRequest();
    await wizard.finishWizard();

    // API verify: permission request no longer approved
    const permRequests = await apiClient.getEnvironmentPermissionRequests(resourceDevEnvId);
    const inbound = permRequests.inboundPermissionRequests;
    const approvedRequest = inbound.find(
      pr => pr.targetPermissionName === roleName && pr.status === 'APPROVED',
    );
    expect(approvedRequest).toBeUndefined();
  });

  test('cleanup: delete both applications via API', async ({ apiClient }) => {
    const errors: Error[] = [];

    if (clientAppId) {
      try { await apiClient.deleteApplication(clientAppId); } catch (e) { errors.push(e as Error); }
    }
    if (resourceAppId) {
      try { await apiClient.deleteApplication(resourceAppId); } catch (e) { errors.push(e as Error); }
    }

    if (errors.length > 0) {
      console.error('Cleanup errors:', errors);
    }
  });
});
