import { type Locator, type Page, expect } from '@playwright/test';

export class TokenTesterPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly clientCredentialSelect: Locator;
  readonly targetEnvironmentSelect: Locator;
  readonly tokenBody: Locator;
  readonly rawToken: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Token Tester' });
    this.clientCredentialSelect = page.locator('select').first();
    this.targetEnvironmentSelect = page.locator('select').nth(1);
    this.tokenBody = page.locator('text=Body').locator('..').locator('pre');
    this.rawToken = page.locator('text=Raw JWT Token').locator('..').locator('pre');
  }

  async goto(envId: string) {
    await this.page.goto(`/environments/${envId}/token-tester`);
    await this.page.waitForFunction(() => !document.body.textContent?.includes('Loading environment...'));
  }

  async waitForLoad() {
    await this.page.waitForFunction(
      () => !document.body.textContent?.includes('Loading environment...'),
      { timeout: 10_000 },
    );
  }

  async selectCredential(index: number = 0) {
    // Select the first non-placeholder option
    const options = await this.clientCredentialSelect.locator('option').all();
    if (options.length > 1) {
      await this.clientCredentialSelect.selectOption({ index: index + 1 });
    }
  }

  async selectTargetEnvironment(envName: string) {
    await this.targetEnvironmentSelect.selectOption({ label: envName });
  }

  async waitForToken() {
    await expect(this.page.getByText('Raw JWT Token')).toBeVisible({ timeout: 15_000 });
  }

  async getTokenBodyJson(): Promise<any> {
    const bodyText = await this.tokenBody.innerText();
    return JSON.parse(bodyText);
  }

  async expectRoleInToken(roleName: string) {
    const body = await this.getTokenBodyJson();
    expect(body.roles).toBeDefined();
    expect(body.roles).toContain(roleName);
  }

  async expectRoleNotInToken(roleName: string) {
    const body = await this.getTokenBodyJson();
    const roles = body.roles ?? [];
    expect(roles).not.toContain(roleName);
  }
}
