import { type Locator, type Page, expect } from '@playwright/test';

export class CreateApplicationPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly nameInput: Locator;
  readonly descriptionInput: Locator;
  readonly secretCheckbox: Locator;
  readonly devCheckbox: Locator;
  readonly testCheckbox: Locator;
  readonly qaCheckbox: Locator;
  readonly prodCheckbox: Locator;
  readonly createButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Create a new Application' });
    this.nameInput = page.getByTestId('app-name-input');
    this.descriptionInput = page.getByTestId('app-description-input');
    this.secretCheckbox = page.getByRole('checkbox', { name: /secret/i });
    this.devCheckbox = page.getByTestId('env-checkbox-dev');
    this.testCheckbox = page.getByTestId('env-checkbox-test');
    this.qaCheckbox = page.getByTestId('env-checkbox-qa');
    this.prodCheckbox = page.getByTestId('env-checkbox-prod');
    this.createButton = page.getByRole('button', { name: 'Create' });
  }

  async goto() {
    await this.page.goto('/applications/create');
  }

  async expectFormVisible() {
    await expect(this.heading).toBeVisible();
    await expect(this.nameInput).toBeVisible();
    await expect(this.descriptionInput).toBeVisible();
    await expect(this.createButton).toBeVisible();
  }

  async expectEnvironmentCheckboxesVisible() {
    await expect(this.devCheckbox).toBeVisible();
    await expect(this.testCheckbox).toBeVisible();
    await expect(this.qaCheckbox).toBeVisible();
    await expect(this.prodCheckbox).toBeVisible();
  }

  async fillName(name: string) {
    await this.nameInput.fill(name);
  }

  async fillDescription(description: string) {
    await this.descriptionInput.fill(description);
  }

  async selectEnvironments(...envs: ('dev' | 'test' | 'qa' | 'prod')[]) {
    for (const env of envs) {
      const checkbox = this.page.getByTestId(`env-checkbox-${env}`);
      await checkbox.click();
    }
  }

  async submit() {
    await this.createButton.click();
  }
}
