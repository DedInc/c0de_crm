/**
 * Validation utilities
 */

export function isValidTelegramId(telegramId: string | null | undefined): telegramId is string {
	if (!telegramId) return false;
	return /^\d{7,15}$/.test(telegramId);
}
