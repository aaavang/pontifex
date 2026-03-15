import { type Locator, type Page, expect } from '@playwright/test';

export class PendingPermissionsPage {
  readonly page: Page;

  readonly heading: Locator;
  readonly approveAllButton: Locator;
  readonly rejectAllButton: Locator;
  readonly saveButton: Locator;
  readonly noRequestsText: Locator;

  constructor(page: Page) {
    this.page = page;

    this.heading = page.getByRole('heading', { name: 'Pending Permission Requests' });
    this.approveAllButton = page.getByRole('button', { name: 'Approve All' });
    this.rejectAllButton = page.getByRole('button', { name: 'Reject All' });
    this.saveButton = page.getByRole('button', { name: 'Save' });
    this.noRequestsText = page.getByText('No pending permission requests');
  }

  async goto(envId?: string) {
    let url = '/permission-requests/pending';
    if (envId) {
      url += `?envId=${envId}`;
    }
    await this.page.goto(url);
    await this.page.waitForTimeout(2000); // wait for data to load
  }

  async waitForLoad() {
    const hasRequests = await this.heading.isVisible({ timeout: 5_000 }).catch(() => false);
    const noRequests = await this.noRequestsText.isVisible().catch(() => false);
    expect(hasRequests || noRequests).toBeTruthy();
  }

  async approveAll() {
    await this.approveAllButton.click();
  }

  async rejectAll() {
    await this.rejectAllButton.click();
  }

  async setActionForRequest(permissionName: string, action: 'APPROVE' | 'REJECT') {
    const row = this.page.locator('tr').filter({ hasText: permissionName });
    const radio = row.getByRole('radio', { name: action === 'APPROVE' ? 'Approve' : 'Reject' });
    await radio.check();
  }

  async save() {
    // window.confirm will be auto-accepted by Playwright
    this.page.on('dialog', dialog => dialog.accept());
    await this.saveButton.click();
    await expect(this.page.getByText(/statuses updated/i)).toBeVisible({ timeout: 5_000 });
  }
}
