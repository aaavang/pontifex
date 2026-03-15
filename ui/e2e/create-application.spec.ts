import { test, expect } from './fixtures';
import { CreateApplicationPage } from './pages/create-application.page';

test.describe('Create Application', () => {
  let createApp: CreateApplicationPage;

  test.beforeEach(async ({ page }) => {
    createApp = new CreateApplicationPage(page);
    await createApp.goto();
  });

  test('displays the create application form', async () => {
    await createApp.expectFormVisible();
  });

  test('displays all environment checkboxes', async () => {
    await createApp.expectEnvironmentCheckboxesVisible();
  });

  test('name field is required', async ({ page }) => {
    // Leave name empty and try to submit
    await createApp.selectEnvironments('dev');
    await createApp.submit();

    await expect(page.getByText('Name is required')).toBeVisible();
  });

  test('can fill in the form fields', async () => {
    await createApp.fillName('Test Application');
    await createApp.fillDescription('A test application for Playwright');
    await createApp.selectEnvironments('dev', 'test');

    await expect(createApp.nameInput).toHaveValue('Test Application');
    await expect(createApp.descriptionInput).toHaveValue('A test application for Playwright');
    await expect(createApp.devCheckbox).toBeChecked();
    await expect(createApp.testCheckbox).toBeChecked();
    await expect(createApp.qaCheckbox).not.toBeChecked();
    await expect(createApp.prodCheckbox).not.toBeChecked();
  });
});
