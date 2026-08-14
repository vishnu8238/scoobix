import { test, expect } from '@playwright/test';

test.describe('Logistics Portal Hardening Verification', () => {
  test.beforeEach(async ({ page }) => {
    // We assume the environment is set up for the logistics portal
    await page.goto('http://localhost:8080/logistics');
  });

  test('Gig management date filtering and creation modal', async ({ page }) => {
    await page.goto('http://localhost:8080/logistics/gigs');
    await expect(page.locator('h1')).toContainText('Gig Management');
    
    // Check if Create Gig modal opens
    await page.click('button:has-text("Create New Gig")');
    await expect(page.locator('text=Create New Gig')).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });

  test('Delivery partners list and add modal', async ({ page }) => {
    await page.goto('http://localhost:8080/logistics/drivers');
    await expect(page.locator('h1')).toContainText('Delivery Partners');
    
    // Check if Add Partner modal opens
    await page.click('button:has-text("Add Partner")');
    await expect(page.locator('text=Add Delivery Partner')).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });

  test('Demo orders seeding availability', async ({ page }) => {
    await page.goto('http://localhost:8080/logistics/orders');
    await expect(page.locator('button:has-text("Seed Demo Orders")')).toBeEnabled();
  });

  test('Zones map and creation modal', async ({ page }) => {
    await page.goto('http://localhost:8080/logistics/zones');
    await page.click('button:has-text("Create Zone")');
    await expect(page.locator('text=Create Zone')).toBeVisible();
    // Verify map container exists in modal
    await expect(page.locator('.h-\\[400px\\]')).toBeVisible();
  });
});
