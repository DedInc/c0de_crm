import { notifyBot } from '../bot/webhook-helpers';

export function isValidTelegramId(telegramId: string | null | undefined): boolean {
	if (!telegramId) return true;
	return /^\d{7,15}$/.test(telegramId);
}

const ERROR_CODE_TO_I18N: Record<string, string> = {
	'BOT_BLOCKED': 'error.botBlocked',
	'INVALID_TELEGRAM_ID_OR_NOT_STARTED': 'error.invalidTelegramIdOrNotStarted',
	'INVALID_TELEGRAM_ID_FORMAT': 'error.invalidTelegramIdFormat'
};

export async function sendTelegramVerification(
	telegramId: string
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
	return notifyBot('verify-telegram', { telegramId })
		.then(() => ({ success: true }))
		.catch((error) => {
			const errorCode = error.errorCode || error.error;
			const i18nKey = ERROR_CODE_TO_I18N[errorCode];
			return {
				success: false,
				error: i18nKey || error.error || 'Failed to send verification message',
				errorCode: errorCode
			};
		});
}
