import { type Locator, type Page, expect } from '@playwright/test';

export class ApplicationDetailPage {
  readonly page: Page;

  readonly optionsMenuButton: Locator;
  readonly deleteMenuItem: Locator;
  readonly updateMenuItem: Locator;

  constructor(page: Page) {
    this.page = page;

    this.optionsMenuButton = page.getByRole('button', { name: 'Options' });
    this.deleteMenuItem = page.getByRole('menuitem', { name: 'Delete' });
    this.updateMenuItem = page.getByRole('menuitem', { name: 'Update' });
  }

  async goto(appId: string) {
    await this.page.goto(`/applications/${appId}`);
    await this.waitForLoad();
  }

  async waitForLoad() {
    // Wait for loading state to disappear
    await this.page.waitForFunction(
      () => !document.body.textContent?.includes('Loading application...'),
      { timeout: 10_000 },
    );
  }

  get appName() {
    return this.page.locator('h1.chakra-heading').first();
  }

  get visibilityBadge() {
    return this.page.locator('.chakra-badge').first();
  }

  async getEnvironmentLink(level: string) {
    return this.page.getByRole('link', { name: level.toUpperCase() });
  }

  async navigateToEnvironment(level: string) {
    const link = await this.getEnvironmentLink(level);
    await link.click();
    await this.page.waitForURL(/\/environments\//);
  }

  async openUpdateModal() {
    await this.optionsMenuButton.click();
    await this.updateMenuItem.click();
    await expect(this.page.getByText('Update Application')).toBeVisible();
  }

  async deleteApplication() {
    this.page.on('dialog', d => d.accept());
    await this.optionsMenuButton.click();
    await this.deleteMenuItem.click();
  }
}
