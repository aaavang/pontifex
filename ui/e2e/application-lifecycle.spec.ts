import { test, expect } from './fixtures';
import { CreateApplicationPage } from './pages/create-application.page';
import { ApplicationDetailPage } from './pages/application-detail.page';
import { EnvironmentDetailPage } from './pages/environment-detail.page';
import { ConnectionWizardPage } from './pages/connection-wizard.page';
import { TokenTesterPage } from './pages/token-tester.page';
import { PendingPermissionsPage } from './pages/pending-permissions.page';

/**
 * Full application lifecycle test:
 *
 * 1. Create a resource app and a client app (both with dev environment)
 * 2. Add roles to the resource app's dev environment
 * 3. Request access from the client app to the resource app's roles
 * 4. Verify the permission request is auto-approved (user owns both apps)
 * 5. Create a client credential on the client app
 * 6. Use the token tester to get a JWT and verify it contains the approved roles
 * 7. Reject the permission request
 * 8. Verify a new token no longer contains the rejected roles
 * 9. Clean up: delete both applications
 */
test.describe('Application Lifecycle', () => {
  test.describe.configure({ timeout: 120_000 });

  let resourceAppId: string;
  let clientAppId: string;
  let resourceEnvId: string;
  let clientEnvId: string;

  const resourceAppName = `e2e-resource-${Date.now()}`;
  const clientAppName = `e2e-client-${Date.now()}`;
  const testRoleName = 'e2e-test-role';
  const testRoleDescription = 'Role created by Playwright e2e test';

  test('full lifecycle: create apps, request access, verify tokens, reject access', async ({ page }) => {
    // Accept all confirmation dialogs throughout the test
    page.on('dialog', dialog => dialog.accept());

    // =============================================
    // Step 1: Create the resource application
    // =============================================
    const createApp = new CreateApplicationPage(page);
    await createApp.goto();
    await createApp.fillName(resourceAppName);
    await createApp.fillDescription('Resource application for e2e testing');
    await createApp.selectEnvironments('dev');
    await createApp.submit();

    // Wait for success then redirect
    await expect(page.getByText('Successfully created application').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(
      () => /\/applications\/[0-9a-f]/.test(window.location.pathname),
      { timeout: 30_000 },
    );
    resourceAppId = new URL(page.url()).pathname.split('/applications/')[1];

    const appDetail = new ApplicationDetailPage(page);
    await appDetail.waitForLoad();

    // Get the dev environment ID by navigating to it
    await appDetail.navigateToEnvironment('DEV');
    await page.waitForURL(/\/environments\//);
    resourceEnvId = new URL(page.url()).pathname.split('/environments/')[1];

    // =============================================
    // Step 2: Add a role to the resource app's dev environment
    // =============================================
    const envDetail = new EnvironmentDetailPage(page);
    await envDetail.waitForLoad();
    await envDetail.addRole(testRoleName, { description: testRoleDescription });
    await envDetail.expectRoleVisible(testRoleName);

    // =============================================
    // Step 3: Create the client application
    // =============================================
    await createApp.goto();
    await createApp.fillName(clientAppName);
    await createApp.fillDescription('Client application for e2e testing');
    await createApp.selectEnvironments('dev');
    await createApp.submit();

    await expect(page.getByText('Successfully created application').first()).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(
      () => /\/applications\/[0-9a-f]/.test(window.location.pathname),
      { timeout: 30_000 },
    );
    clientAppId = new URL(page.url()).pathname.split('/applications/')[1];

    const clientAppDetail = new ApplicationDetailPage(page);
    await clientAppDetail.waitForLoad();

    // Get the client dev environment ID
    await clientAppDetail.navigateToEnvironment('DEV');
    await page.waitForURL(/\/environments\//);
    clientEnvId = new URL(page.url()).pathname.split('/environments/')[1];

    // =============================================
    // Step 4: Create a client credential on the client app
    // =============================================
    const clientEnvDetail = new EnvironmentDetailPage(page);
    await clientEnvDetail.waitForLoad();
    await clientEnvDetail.createClientCredential();

    // =============================================
    // Step 5: Request access from client to resource
    // =============================================
    const wizard = new ConnectionWizardPage(page);
    await wizard.goto({
      sourceApplication: clientAppId,
      sourceEnvironment: clientEnvId,
      sourceEnvironmentLevel: 'dev',
    });

    // Select target application
    await wizard.selectTargetApplication(resourceAppName);

    // Select target environment (dev)
    await wizard.selectTargetEnvironment('DEV');

    // Select the test role
    await wizard.selectRoles(testRoleName);

    // Submit the access request
    await wizard.submitAccessRequest();

    // Click Next to redirect back to environment
    await wizard.finishWizard();

    // =============================================
    // Step 6: Verify the token contains the approved role
    // =============================================
    const tokenTester = new TokenTesterPage(page);
    await tokenTester.goto(clientEnvId);
    await tokenTester.waitForLoad();

    // Select the client credential and target environment
    await tokenTester.selectCredential(0);

    // The resource app's dev env should be listed as a connected environment
    const resourceEnvDetail = new EnvironmentDetailPage(page);
    // Go to token tester for the client env
    await tokenTester.goto(clientEnvId);
    await tokenTester.waitForLoad();
    await tokenTester.selectCredential(0);

    // Select the resource env as target
    const targetSelect = tokenTester.targetEnvironmentSelect;
    // Wait for options to populate and select the first non-placeholder
    await page.waitForTimeout(1000);
    await targetSelect.selectOption({ index: 1 });

    // Wait for token to be fetched
    await tokenTester.waitForToken();

    // Verify the token body contains our role
    await tokenTester.expectRoleInToken(testRoleName);

    // =============================================
    // Step 7: Reject the permission request via the pending page
    // =============================================
    const pendingPage = new PendingPermissionsPage(page);
    // Navigate to the client env to find outbound permission requests
    await envDetail.goto(clientEnvId);
    await envDetail.waitForLoad();

    // Go to pending permissions and reject
    await pendingPage.goto();
    await pendingPage.waitForLoad();

    // If there are pending requests (auto-approved ones won't show here),
    // we need to go to the resource env's inbound requests and reject from there
    // Actually, since both apps are owned by the same user, the request is auto-approved.
    // To reject, we need to go back to the permission request and change its status.

    // Navigate to resource env to see inbound approved requests
    await page.goto(`/environments/${resourceEnvId}`);
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading environment...'));

    // Find the permission request in the outbound section from the client env
    // and change it via the API (the UI groups inbound requests)
    // Let's use the pending permissions page to reject

    // Go back to client environment to see outbound requests and find the PR IDs
    await page.goto(`/environments/${clientEnvId}`);
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading environment...'));

    // The permission was auto-approved, so to "reject" it, we need to remove the
    // permission by going through the connection wizard again with the role unchecked
    await wizard.goto({
      sourceApplication: clientAppId,
      sourceEnvironment: clientEnvId,
      sourceEnvironmentLevel: 'dev',
    });

    await wizard.selectTargetApplication(resourceAppName);
    await wizard.selectTargetEnvironment('DEV');

    // Uncheck the role (it should be checked from the previous request)
    const roleCheckbox = page.getByRole('checkbox', { name: testRoleName });
    if (await roleCheckbox.isChecked()) {
      await roleCheckbox.uncheck();
    }

    await wizard.submitAccessRequest();
    await wizard.finishWizard();

    // =============================================
    // Step 8: Verify the token no longer contains the role
    // =============================================
    await tokenTester.goto(clientEnvId);
    await tokenTester.waitForLoad();
    await tokenTester.selectCredential(0);
    await page.waitForTimeout(1000);
    await targetSelect.selectOption({ index: 1 });
    await tokenTester.waitForToken();
    await tokenTester.expectRoleNotInToken(testRoleName);

    // =============================================
    // Step 9: Clean up - delete both applications
    // =============================================

    // Delete client app
    await page.goto(`/applications/${clientAppId}`);
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading application...'));
    const clientDetail = new ApplicationDetailPage(page);
    await clientDetail.deleteApplication();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });

    // Delete resource app
    await page.goto(`/applications/${resourceAppId}`);
    await page.waitForFunction(() => !document.body.textContent?.includes('Loading application...'));
    const resourceDetail = new ApplicationDetailPage(page);
    await resourceDetail.deleteApplication();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  });
});
