import { test, expect } from './fixtures';
import { NavigationPage } from './pages/navigation.page';

test.describe('Navigation', () => {
  let nav: NavigationPage;

  test.beforeEach(async ({ page }) => {
    nav = new NavigationPage(page);
    await page.goto('/');
  });

  test('displays the global navigation bar and primary links', async () => {
    await nav.expectNavigationVisible();
  });

  test('Home link navigates to the home page', async () => {
    await nav.page.goto('/dashboard');
    await nav.goHome();

    await expect(nav.page).toHaveURL('/');
  });

  test('My Dashboard link navigates to dashboard', async () => {
    await nav.goToDashboard();

    await expect(nav.page).toHaveURL(/\/dashboard/);
  });
});
