import { test, expect } from '@playwright/test';

test.describe('Identity Resolution Regression', () => {
  test('should not render literal "User" in logistics sidebar', async ({ page }) => {
    // 1. Setup mock session in localStorage before navigation
    await page.goto('/');
    
    const mockUser = {
      id: "test-uuid-admin",
      email: "scoobix.info@gmail.com",
      user_metadata: {
        full_name: "Scoobix Admin",
        name: "Scoobix Admin"
      },
      role: "authenticated",
      aud: "authenticated"
    };
    
    const mockSession = {
      access_token: "mock-jwt-token",
      user: mockUser,
      expires_at: 2147483647
    };

    await page.evaluate((session) => {
      localStorage.setItem('scoobix_auth_token', JSON.stringify(session));
      localStorage.setItem('sb-9d873abd-530b-47a7-8a36-b38cc54dbdf5-auth-token', JSON.stringify(session));
    }, mockSession);

    // 2. Navigate to logistics zones
    await page.goto('/logistics/zones');

    // 3. Assert identity resolution
    const nameLocator = page.locator('[data-testid="sidebar-user-name"]');
    
    // Polling assertion to wait for hydration/resolution
    await expect(async () => {
      const text = await nameLocator.innerText();
      expect(text).not.toBe("...");
      expect(text.toLowerCase()).not.toBe("user");
      expect(text.toLowerCase()).not.toBe("logistics staff");
      expect(text.toLowerCase()).not.toBe("logistics");
      expect(text.length).toBeGreaterThan(0);
    }).toPass({ timeout: 15000 });
  });
});
