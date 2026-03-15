import { type Locator, type Page, expect } from '@playwright/test';

export class NavigationPage {
  readonly page: Page;

  // Global navigation
  readonly appTitle: Locator;
  readonly logo: Locator;

  // Primary navigation links
  readonly homeLink: Locator;
  readonly dashboardLink: Locator;
  readonly documentationLink: Locator;
  readonly supportLink: Locator;

  constructor(page: Page) {
    this.page = page;

    this.appTitle = page.getByText('Pontifex', { exact: false }).first();
    this.logo = page.getByAltText('pontifex logo white');

    this.homeLink = page.getByRole('link', { name: 'Home' });
    this.dashboardLink = page.getByRole('link', { name: 'My Dashboard' });
    this.documentationLink = page.getByRole('link', { name: 'Documentation' });
    this.supportLink = page.getByRole('link', { name: 'Something Broken?' });
  }

  async expectNavigationVisible() {
    await expect(this.appTitle).toBeVisible();
    await expect(this.homeLink).toBeVisible();
    await expect(this.dashboardLink).toBeVisible();
    await expect(this.documentationLink).toBeVisible();
    await expect(this.supportLink).toBeVisible();
  }

  async goHome() {
    await this.homeLink.click();
  }

  async goToDashboard() {
    await this.dashboardLink.click();
  }
}
