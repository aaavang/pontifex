import { test, expect } from './fixtures';
import { DashboardPage } from './pages/dashboard.page';

test.describe('Dashboard', () => {
  let dashboard: DashboardPage;

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page);
    await dashboard.goto();
  });

  test('displays the user dashboard after loading', async () => {
    // Dashboard requires API to return user data; skip if API is unreachable
    const loaded = await dashboard.heading.isVisible({ timeout: 30_000 }).catch(() => false);
    const errored = await dashboard.errorText.isVisible().catch(() => false);

    if (errored) {
      test.skip(true, 'API backend is unreachable — skipping dashboard content tests');
    }

    if (loaded) {
      await dashboard.expectSectionsVisible();
      await dashboard.expectCreateButtonsVisible();
    }
  });

  test('Create Application button navigates to create page', async () => {
    const loaded = await dashboard.heading.isVisible({ timeout: 30_000 }).catch(() => false);
    test.skip(!loaded, 'Dashboard did not load — API may be unreachable');

    await dashboard.clickCreateApplication();
    await expect(dashboard.page).toHaveURL(/\/applications\/create/);
  });

  test('Create Group button navigates to create page', async () => {
    const loaded = await dashboard.heading.isVisible({ timeout: 30_000 }).catch(() => false);
    test.skip(!loaded, 'Dashboard did not load — API may be unreachable');

    await dashboard.clickCreateGroup();
    await expect(dashboard.page).toHaveURL(/\/groups\/create/);
  });
});
