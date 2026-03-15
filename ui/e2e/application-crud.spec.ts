import { test, expect } from './fixtures';
import { CreateApplicationPage } from './pages/create-application.page';
import { ApplicationDetailPage } from './pages/application-detail.page';
import { EnvironmentDetailPage } from './pages/environment-detail.page';

test.describe.serial('Application CRUD', () => {
  const appName = `e2e-crud-${Date.now()}`;
  let appId: string;
  let envId: string;

  test('create an application with environments', async ({ page }) => {
    const createApp = new CreateApplicationPage(page);
    await createApp.goto();
    await createApp.fillName(appName);
    await createApp.fillDescription('CRUD test application');
    await createApp.selectEnvironments('dev', 'test');
    await createApp.submit();

    // Wait for the success toast confirming creation
    await expect(page.getByText('Successfully created application').first()).toBeVisible({ timeout: 30_000 });

    // Wait for navigation to the app detail page (the app name heading appears)
    const detail = new ApplicationDetailPage(page);
    await expect(detail.appName).toHaveText(appName, { timeout: 30_000 });
    appId = new URL(page.url()).pathname.split('/applications/')[1];
    expect(appId).toBeTruthy();
  });

  test('application detail shows environments', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    const devLink = await detail.getEnvironmentLink('DEV');
    const testLink = await detail.getEnvironmentLink('TEST');
    await expect(devLink).toBeVisible();
    await expect(testLink).toBeVisible();
  });

  test('application detail shows visibility badge', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await expect(detail.visibilityBadge).toBeVisible();
  });

  test('application detail shows owner actions menu', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.optionsMenuButton.click();
    await expect(detail.updateMenuItem).toBeVisible();
    await expect(detail.deleteMenuItem).toBeVisible();
  });

  test('can open update modal', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.openUpdateModal();
    await expect(page.getByText('Update Application')).toBeVisible();
  });

  test('can navigate to dev environment', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.navigateToEnvironment('DEV');
    envId = new URL(page.url()).pathname.split('/environments/')[1];
    await expect(page).toHaveURL(/\/environments\//);
  });

  test('environment shows name, client ID, and sections', async ({ page }) => {
    const env = new EnvironmentDetailPage(page);
    await env.goto(envId);
    await expect(env.envName).toBeVisible();
    await expect(page.getByText('Client ID:')).toBeVisible();
    await expect(env.tokenTesterButton).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Roles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Scopes' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Client Credentials' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Outbound Permission Requests' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inbound Permission Requests' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Redirect URLs' })).toBeVisible();
  });

  // --- Roles CRUD (managed from application detail page) ---

  test('add a role', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    const env = new EnvironmentDetailPage(page);
    await env.addRole('api-reader', { description: 'Can read API data' });
    await env.expectRoleVisible('api-reader');
  });

  test('add a second role', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    const env = new EnvironmentDetailPage(page);
    await env.addRole('api-writer', { sensitive: true, description: 'Can write API data' });
    await env.expectRoleVisible('api-writer');
  });

  test('delete a role', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    const env = new EnvironmentDetailPage(page);
    await env.deleteRole('api-writer');
    await expect(page.getByRole('cell', { name: 'api-writer', exact: true })).not.toBeVisible();
  });

  // --- Scopes CRUD (managed from application detail page) ---

  test('add a scope', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    const env = new EnvironmentDetailPage(page);
    await env.addScope('read.users', 'Read Users', 'Allows reading user data');
    await env.expectScopeVisible('read.users');
  });

  test('delete a scope', async ({ page }) => {
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    const env = new EnvironmentDetailPage(page);
    await env.deleteScope('read.users');
    await expect(page.getByRole('cell', { name: 'read.users', exact: true })).not.toBeVisible();
  });

  // --- Client Credentials CRUD ---

  test('create a client credential', async ({ page }) => {
    const env = new EnvironmentDetailPage(page);
    await env.goto(envId);
    await env.createClientCredential();
    await expect(page.locator('.chakra-accordion__button')).toBeVisible();
  });

  test('delete a client credential', async ({ page }) => {
    const env = new EnvironmentDetailPage(page);
    await env.goto(envId);
    await env.deleteClientCredential();
  });

  // --- Redirect URLs CRUD ---

  test('add a SPA redirect URL', async ({ page }) => {
    const env = new EnvironmentDetailPage(page);
    await env.goto(envId);
    await env.addRedirectUrl('http://localhost:3000/callback');
    await expect(page.getByText('http://localhost:3000/callback')).toBeVisible();
  });

  test('add a WEB redirect URL', async ({ page }) => {
    const env = new EnvironmentDetailPage(page);
    await env.goto(envId);
    await env.addRedirectUrl('https://example.com/auth', 'WEB');
    await expect(page.getByText('https://example.com/auth')).toBeVisible();
  });

  test('delete a redirect URL', async ({ page }) => {
    const env = new EnvironmentDetailPage(page);
    await env.goto(envId);
    await env.deleteRedirectUrl('http://localhost:3000/callback');
  });

  // --- Cleanup ---

  test('delete the application', async ({ page }) => {
    page.on('dialog', d => d.accept());
    const detail = new ApplicationDetailPage(page);
    await detail.goto(appId);
    await detail.deleteApplication();
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
  });
});
