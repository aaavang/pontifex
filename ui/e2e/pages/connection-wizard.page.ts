import { type Locator, type Page, expect } from '@playwright/test';

export class ConnectionWizardPage {
  readonly page: Page;

  readonly nextButton: Locator;
  readonly previousButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.nextButton = page.getByRole('button', { name: 'Next' });
    this.previousButton = page.getByRole('button', { name: 'Previous' });
  }

  async goto(params?: { sourceApplication?: string; sourceEnvironment?: string; sourceEnvironmentLevel?: string }) {
    let url = '/connections/update';
    if (params) {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      url += `?${qs}`;
    }
    await this.page.goto(url);
  }

  async selectSourceApplication(appName: string) {
    await expect(this.page.getByText('Select Source Application')).toBeVisible({ timeout: 5_000 });
    const input = this.page.locator('input[id^="react-select"]').first();
    await input.fill(appName);
    await this.page.locator('[class*="option"]').first().click();
    await this.nextButton.click();
  }

  async selectSourceEnvironment(level: string) {
    await expect(this.page.getByText('Select Source Environment')).toBeVisible({ timeout: 5_000 });
    const input = this.page.locator('input[id^="react-select"]').first();
    await input.click();
    await this.page.locator('[class*="option"]').filter({ hasText: level.toUpperCase() }).click();
    await this.nextButton.click();
  }

  async selectTargetApplication(appName: string) {
    await expect(this.page.getByText('Select Target Application')).toBeVisible({ timeout: 5_000 });
    const input = this.page.locator('input[id^="react-select"]').first();
    await input.fill(appName);
    await this.page.locator('[class*="option"]').first().click();
    await this.nextButton.click();
  }

  async selectTargetEnvironment(level: string) {
    await expect(this.page.getByText('Select Target Environment')).toBeVisible({ timeout: 5_000 });
    const input = this.page.locator('input[id^="react-select"]').first();
    await input.click();
    await this.page.locator('[class*="option"]').filter({ hasText: level.toUpperCase() }).click();
    await this.nextButton.click();
  }

  async selectRoles(...roleNames: string[]) {
    await expect(this.page.getByText('Select Target Roles')).toBeVisible({ timeout: 5_000 });
    for (const name of roleNames) {
      await this.page.getByRole('checkbox', { name }).check();
    }
  }

  async selectScopes(...scopeNames: string[]) {
    for (const name of scopeNames) {
      await this.page.getByRole('checkbox', { name }).check();
    }
  }

  async submitAccessRequest() {
    await this.nextButton.click();
    // Wait for synchronization to complete
    await expect(this.page.getByText('Access Synchronization: Successful')).toBeVisible({ timeout: 15_000 });
  }

  async finishWizard() {
    await this.nextButton.click();
  }
}
