/**
 * Validate that a Telegram ID is in the correct format (7-15 digit number)
 */
export function isValidTelegramId(telegramId: string | null | undefined): boolean {
	if (!telegramId) return true; // null/undefined/empty is valid (means not linked)
	return /^\d{7,15}$/.test(telegramId);
}
