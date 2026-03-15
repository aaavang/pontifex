import { type Locator, type Page, expect } from '@playwright/test';

export class DashboardPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly ownedApplicationsHeading: Locator;
  readonly ownedGroupsHeading: Locator;
  readonly memberGroupsHeading: Locator;
  readonly createApplicationButton: Locator;
  readonly createGroupButton: Locator;
  readonly loadingText: Locator;
  readonly errorText: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: /Dashboard/ });
    this.ownedApplicationsHeading = page.getByRole('heading', { name: 'Owned Applications' });
    this.ownedGroupsHeading = page.getByRole('heading', { name: 'Owned Groups' });
    this.memberGroupsHeading = page.getByRole('heading', { name: 'Groups with Membership' });
    this.createApplicationButton = page.getByRole('button', { name: /create application/i });
    this.createGroupButton = page.getByRole('button', { name: /create group/i });
    this.loadingText = page.getByTestId('dashboard-loading');
    this.errorText = page.getByTestId('dashboard-error');
  }

  async goto() {
    await this.page.goto('/dashboard');
    // Wait for dashboard to finish loading (either content loads or error appears)
    await this.loadingText.waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
  }

  async expectLoaded() {
    await expect(this.heading).toBeVisible({ timeout: 30_000 });
  }

  async expectSectionsVisible() {
    await expect(this.ownedApplicationsHeading).toBeVisible();
    await expect(this.ownedGroupsHeading).toBeVisible();
    await expect(this.memberGroupsHeading).toBeVisible();
  }

  async expectCreateButtonsVisible() {
    await expect(this.createApplicationButton).toBeVisible();
    await expect(this.createGroupButton).toBeVisible();
  }

  async clickCreateApplication() {
    await this.createApplicationButton.click();
  }

  async clickCreateGroup() {
    await this.createGroupButton.click();
  }
}
