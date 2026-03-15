import { test, expect } from '../fixtures';
import { CreateGroupPage, DashboardPage } from '../pages';

test.describe.serial('Group Management', () => {
  const groupName = `e2e-group-${Date.now()}`;
  let groupId: string;

  test('create group via UI and verify on page', async ({ page, cleanup, apiClient }) => {
    const createPage = new CreateGroupPage(page);
    await createPage.goto();
    await createPage.fillName(groupName);
    await createPage.submit();

    // Should redirect to group detail page
    await page.waitForURL(/\/groups\//, { timeout: 15_000 });
    groupId = page.url().split('/groups/')[1].split(/[?#]/)[0];
    expect(groupId).toBeTruthy();

    // Verify group name is displayed
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 10_000 });

    // Verify owners and members sections exist
    await expect(page.getByRole('heading', { name: 'Owners' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  });

  test('group appears on dashboard', async ({ page }) => {
    test.skip(!groupId, 'No group ID from previous test');

    const dashboard = new DashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();

    // The group should appear in "Owned Groups" section
    await expect(page.getByText(groupName)).toBeVisible({ timeout: 10_000 });
  });

  test('delete group via UI', async ({ page }) => {
    test.skip(!groupId, 'No group ID from previous test');

    await page.goto(`/groups/${groupId}`);
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible({ timeout: 10_000 });

    // Open options menu and delete
    await page.getByRole('button', { name: 'Options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();

    // Should redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  });
});
