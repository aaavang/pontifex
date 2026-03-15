import { type Locator, type Page, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;

  readonly welcomeHeading: Locator;
  readonly subtitle: Locator;
  readonly logo: Locator;
  readonly selfServiceDescription: Locator;
  readonly aadDescription: Locator;

  constructor(page: Page) {
    this.page = page;

    this.welcomeHeading = page.getByRole('heading', { name: 'Welcome to Pontifex!' });
    this.subtitle = page.getByRole('heading', { name: 'Building Secure Bridges Between Services' });
    this.logo = page.getByRole('img', { name: 'Pontifex Logo', exact: true });
    this.selfServiceDescription = page.getByText(
      'Self-service tool for registering application, environments, and roles/scopes',
    );
    this.aadDescription = page.getByText(/Integrates with Azure Active Directory/);
  }

  async goto() {
    await this.page.goto('/');
  }

  async expectWelcomeVisible() {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.subtitle).toBeVisible();
  }

  async expectFeatureCardsVisible() {
    await expect(this.selfServiceDescription).toBeVisible();
    await expect(this.aadDescription).toBeVisible();
  }

  async expectLogoVisible() {
    await expect(this.logo).toBeVisible();
  }
}
