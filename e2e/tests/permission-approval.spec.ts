import { test, expect } from '../fixtures';
import {
  CreateApplicationPage,
  EnvironmentDetailPage,
  ConnectionWizardPage,
  PendingPermissionsPage,
} from '../pages';

/**
 * Tests the manual permission approval flow.
 *
 * Since we're using a single test user who owns both apps, permission requests
 * are auto-approved by the Connection Wizard. To test the pending/approval flow,
 * we verify the API state after the wizard completes and exercise the
 * PendingPermissionsPage UI to confirm it loads correctly.
 *
 * A true pending-approval test would require two separate users (one requesting,
 * one approving), which is beyond the current single-user test setup.
 */
test.describe.serial('Permission Approval Flow', () => {
  const resourceAppName = `e2e-approval-res-${Date.now()}`;
  const clientAppName = `e2e-approval-cli-${Date.now()}`;
  const roleName = 'Approver.Test';

  let resourceAppId: string;
  let clientAppId: string;
  let resourceDevEnvId: string;
  let clientDevEnvId: string;

  test('setup: create resource and client apps', async ({ page, apiClient, cleanup }) => {
    // Create resource app
    const createPage = new CreateApplicationPage(page);
    await createPage.goto();
    await createPage.fillName(resourceAppName);
    await createPage.fillDescription('Resource app for approval test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    resourceAppId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete resource app`, () => apiClient.deleteApplication(resourceAppId));

    const resourceBundle = await apiClient.getApplication(resourceAppId);
    resourceDevEnvId = resourceBundle.environments[0].id;

    // Create client app
    await createPage.goto();
    await createPage.fillName(clientAppName);
    await createPage.fillDescription('Client app for approval test');
    await createPage.selectEnvironments('dev');
    await createPage.submit();
    await page.waitForURL(/\/applications\//, { timeout: 30_000 });
    clientAppId = page.url().split('/applications/')[1].split(/[?#/]/)[0];
    cleanup.register(`delete client app`, () => apiClient.deleteApplication(clientAppId));

    const clientBundle = await apiClient.getApplication(clientAppId);
    clientDevEnvId = clientBundle.environments[0].id;
  });

  test('add role to resource app', async ({ page, apiClient }) => {
    test.skip(!resourceDevEnvId, 'Missing resource env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(resourceDevEnvId);
    await envPage.addRole(roleName, { description: 'Role for approval test' });
    await envPage.expectRoleVisible(roleName);

    const envBundle = await apiClient.getEnvironment(resourceDevEnvId);
    expect(envBundle.roles.find(r => r.name === roleName)).toBeDefined();
  });

  test('create client credential on client app', async ({ page }) => {
    test.skip(!clientDevEnvId, 'Missing client env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(clientDevEnvId);
    await envPage.createClientCredential();
  });

  test('request access via wizard — auto-approved since same owner', async ({ page, apiClient }) => {
    test.skip(!clientDevEnvId || !resourceDevEnvId, 'Missing env IDs');

    const wizard = new ConnectionWizardPage(page);
    await wizard.goto();
    await wizard.selectSourceApplication(clientAppName);
    await wizard.selectSourceEnvironment('dev');
    await wizard.selectTargetApplication(resourceAppName);
    await wizard.selectTargetEnvironment('dev');
    await wizard.selectRoles(roleName);
    await wizard.submitAccessRequest();
    await wizard.finishWizard();

    // API verify: request exists and is auto-approved
    const permRequests = await apiClient.getEnvironmentPermissionRequests(resourceDevEnvId);
    const matching = permRequests.inboundPermissionRequests.find(
      pr => pr.targetPermissionName === roleName,
    );
    expect(matching).toBeDefined();
    expect(matching!.status).toBe('APPROVED');
  });

  test('pending permissions page loads correctly', async ({ page }) => {
    const pendingPage = new PendingPermissionsPage(page);
    await pendingPage.goto();
    await pendingPage.waitForLoad();
  });

  test('verify inbound requests visible on resource environment page', async ({ page }) => {
    test.skip(!resourceDevEnvId, 'Missing resource env ID');

    const envPage = new EnvironmentDetailPage(page);
    await envPage.goto(resourceDevEnvId);

    // Inbound permission requests section should show the approved request
    await expect(page.getByText('Inbound Permission Requests')).toBeVisible();
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
