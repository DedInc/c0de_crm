import { expect, test, type Page } from '@playwright/test';

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;
const seededOrderId = process.env.E2E_ORDER_ID;

async function login(page: Page): Promise<void> {
	await page.goto('/login');
	await page.locator('#username').fill(username!);
	await page.locator('#password').fill(password!);
	await page.getByRole('button', { name: /login|sign in|войти/i }).click();
	await expect(page).toHaveURL(/\/dashboard|\/profile/);
}

test.describe('top CRM journeys', () => {
	test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD for seeded CRM browser journeys');

	test('login redirects to the authenticated dashboard', async ({ page }) => {
		await login(page);
		await page.goto('/dashboard');
		await expect(page.getByRole('heading', { name: /dashboard|панель/i })).toBeVisible();
	});

	test('order-to-payment journey opens the payment workflow for a seeded order', async ({ page }) => {
		test.skip(!seededOrderId, 'Set E2E_ORDER_ID to an order that can receive payment info');

		await login(page);
		await page.goto(`/orders/${seededOrderId}`);
		await expect(page).toHaveURL(new RegExp(`/orders/${seededOrderId}`));
		await page.getByRole('button', { name: /payment|оплат/i }).click();
		await expect(page.getByRole('dialog')).toBeVisible();
	});

	test('role and permission management page is reachable', async ({ page }) => {
		await login(page);
		await page.goto('/roles');
		await expect(page.getByRole('heading', { name: /roles|роли/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /add|create|добав/i })).toBeVisible();
	});
});
