import { test, expect } from './fixtures';
import { HomePage } from './pages/home.page';

test.describe('Home page', () => {
  let homePage: HomePage;

  test.beforeEach(async ({ page }) => {
    homePage = new HomePage(page);
    await homePage.goto();
  });

  test('displays welcome message for authenticated user', async () => {
    await homePage.expectWelcomeVisible();
  });

  test('displays feature description cards', async () => {
    await homePage.expectFeatureCardsVisible();
  });

  test('displays the Pontifex logo', async () => {
    await homePage.expectLogoVisible();
  });
});
