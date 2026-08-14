import { test, expect } from '@playwright/test';

test('Create New Gig modal contains City and Zone selectors', async ({ page }) => {
  await page.goto('http://localhost:8080/logistics/gigs');
  
  // Wait for page load
  await expect(page.getByRole('heading', { name: /Fleet Gig Management/i })).toBeVisible();
  
  // Open modal
  const createButton = page.getByRole('button', { name: /\+ Create New Gig/i });
  await createButton.click();
  
  // Check modal visibility
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Create New Gig');
  
  // ASSERTION: City selector must be visible
  const cityLabel = modal.locator('label:has-text("CITY")');
  await expect(cityLabel).toBeVisible();
  
  // ASSERTION: Zone selector must be visible
  const zoneLabel = modal.locator('label:has-text("ZONE")');
  await expect(zoneLabel).toBeVisible();
  
  // Check interactive elements (Select triggers)
  const triggers = modal.locator('button[role="combobox"]');
  await expect(triggers).toHaveCount(2);
  
  // Verify City placeholder
  await expect(modal.locator('button[role="combobox"]').first()).toContainText('Select City');
});
