import { type Locator, type Page, expect } from '@playwright/test';

export class EnvironmentDetailPage {
  readonly page: Page;

  readonly tokenTesterButton: Locator;
  readonly createPermissionRequestButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.tokenTesterButton = page.getByRole('button', { name: 'Token Tester' });
    this.createPermissionRequestButton = page.getByRole('button', { name: 'Create Permission Request' });
  }

  async goto(envId: string) {
    await this.page.goto(`/environments/${envId}`);
    await this.waitForLoad();
  }

  async waitForLoad() {
    await this.page.waitForFunction(
      () => !document.body.textContent?.includes('Loading environment...'),
      { timeout: 10_000 },
    );
  }

  get envName() {
    return this.page.locator('.chakra-card__header .chakra-heading').first();
  }

  // --- Roles ---

  get addRoleButton() {
    return this.page.getByRole('button', { name: 'Add Role' }).first();
  }

  async addRole(name: string, options?: { sensitive?: boolean; description?: string }) {
    await this.addRoleButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Name').fill(name);
    if (options?.sensitive) {
      await dialog.getByText('Sensitive').click();
    }
    if (options?.description) {
      await dialog.locator('textarea').fill(options.description);
    }
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByText('Roles Updated').first()).toBeVisible({ timeout: 20_000 });
  }

  async expectRoleVisible(name: string) {
    await expect(this.page.getByRole('cell', { name, exact: true }).first()).toBeVisible({ timeout: 5_000 });
  }

  async deleteRole(name: string) {
    this.page.on('dialog', d => d.accept());
    const row = this.page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Remove Role' }).click();
    // Role deletion involves disable + remove in Azure AD, each with retries
    await expect(this.page.getByText('Roles Updated').first()).toBeVisible({ timeout: 60_000 });
  }

  // --- Scopes ---

  get addScopeButton() {
    return this.page.getByRole('button', { name: 'Add Scope' });
  }

  async addScope(name: string, displayName: string, description: string) {
    await this.addScopeButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('Name').fill(name);
    await dialog.getByPlaceholder('Display Name').fill(displayName);
    await dialog.locator('textarea').fill(description);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(this.page.getByText('Scopes Updated').first()).toBeVisible({ timeout: 10_000 });
  }

  async expectScopeVisible(name: string) {
    await expect(this.page.getByRole('cell', { name, exact: true }).first()).toBeVisible({ timeout: 5_000 });
  }

  async deleteScope(name: string) {
    this.page.on('dialog', d => d.accept());
    const row = this.page.locator('tr').filter({ hasText: name });
    await row.getByRole('button', { name: 'Remove Scope' }).click();
    await expect(this.page.getByText('Scopes Updated').first()).toBeVisible({ timeout: 10_000 });
  }

  // --- Client Credentials ---

  async createClientCredential() {
    // Find the green + button next to "Client Credentials" heading
    const section = this.page.locator('.chakra-card').filter({ hasText: 'Client Credentials' });
    const addButton = section.locator('.chakra-card__header').getByRole('button');
    await addButton.click();
    await expect(this.page.getByText('Created Client Credential').first()).toBeVisible({ timeout: 15_000 });
  }

  async getFirstCredentialSecret(): Promise<string> {
    const firstAccordion = this.page.locator('.chakra-accordion__button').first();
    await firstAccordion.click();
    const secretCell = this.page.locator('.chakra-accordion__panel').first().locator('td').first();
    const text = await secretCell.innerText();
    return text.trim();
  }

  async deleteClientCredential() {
    this.page.on('dialog', d => d.accept());
    const firstAccordion = this.page.locator('.chakra-accordion__button').first();
    await firstAccordion.click();
    await this.page.getByRole('button', { name: 'Delete Password' }).first().click();
    await expect(this.page.getByText('Client Credential Deleted').first()).toBeVisible({ timeout: 10_000 });
  }

  // --- Redirect URLs ---

  async addRedirectUrl(url: string, type: 'SPA' | 'WEB' = 'SPA') {
    const section = this.page.locator('.chakra-card').filter({ hasText: 'Redirect URLs' });
    await section.locator('.chakra-card__header').getByRole('button').click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByPlaceholder('http://localhost:3000').fill(url);
    if (type === 'WEB') {
      await dialog.getByRole('radio', { name: 'WEB' }).click();
    }
    await dialog.getByRole('button', { name: 'Add' }).click();
    await expect(this.page.getByText('Added Redirect URL').first()).toBeVisible({ timeout: 10_000 });
  }

  async deleteRedirectUrl(url: string) {
    this.page.on('dialog', d => d.accept());
    const row = this.page.locator('div').filter({ hasText: url }).first();
    await row.getByRole('button', { name: 'Delete Redirect URL' }).click();
    await expect(this.page.getByText('Removed Redirect URL').first()).toBeVisible({ timeout: 10_000 });
  }

  // --- Navigation ---

  async goToTokenTester() {
    await this.tokenTesterButton.click();
  }

  async goToCreatePermissionRequest() {
    await this.createPermissionRequestButton.click();
  }
}
