<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import { user, checkAuth } from '$lib/stores/auth';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { TelegramSection, PasswordSection } from '$lib/components/profile';

	let telegramId = $state('');
	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');

	let savingTelegram = $state(false);
	let savingPassword = $state(false);

	let telegramSuccess = $state(false);
	let telegramError = $state('');
	let passwordSuccess = $state(false);
	let passwordError = $state('');

	onMount(() => {
		telegramId = $user?.telegramId || '';
	});

	async function saveTelegramId() {
		savingTelegram = true;
		telegramSuccess = false;
		telegramError = '';
		try {
			// If telegramId is provided, verify it first by sending a test message
			if (telegramId && telegramId.trim() !== '') {
				await trpc.users.verifyAndLinkTelegram.mutate({
					telegramId: telegramId.trim()
				});
			} else {
				// Just unlink if empty
				await trpc.users.updateOwnTelegramId.mutate({
					telegramId: null
				});
			}
			telegramSuccess = true;
			await checkAuth();
			setTimeout(() => (telegramSuccess = false), 3000);
		} catch (e: unknown) {
			const error = e as Error;
			const errorMessage = error.message || 'profile.telegramVerificationFailed';
			// Check if the error message is an i18n key (starts with 'error.' or 'profile.')
			if (errorMessage.startsWith('error.') || errorMessage.startsWith('profile.')) {
				telegramError = $t(errorMessage);
			} else {
				telegramError = errorMessage;
			}
			console.error('Failed to save Telegram ID:', e);
		} finally {
			savingTelegram = false;
		}
	}

	async function changePassword() {
		passwordError = '';
		passwordSuccess = false;

		if (!currentPassword || !newPassword) {
			passwordError = $t('profile.allFieldsRequired');
			return;
		}

		if (newPassword !== confirmPassword) {
			passwordError = $t('profile.passwordsDoNotMatch');
			return;
		}

		if (newPassword.length < 6) {
			passwordError = $t('profile.passwordTooShort');
			return;
		}

		savingPassword = true;
		try {
			await trpc.users.update.mutate({
				id: $user!.id,
				password: newPassword
			});
			passwordSuccess = true;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			setTimeout(() => (passwordSuccess = false), 3000);
		} catch (e: unknown) {
			passwordError = (e as Error).message || $t('profile.passwordChangeFailed');
		} finally {
			savingPassword = false;
		}
	}
</script>

<div class="space-y-6 max-w-2xl">
	<h1 class="text-3xl font-bold">{$t('profile.title')}</h1>

	<!-- User Info -->
	<Card.Root>
		<Card.Header>
			<Card.Title>{$t('auth.username')}</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<div>
					<p class="text-2xl font-bold">{$user?.username}</p>
				</div>
				<div class="flex flex-wrap gap-2">
					{#each $user?.roles || [] as role}
						<Badge>{role}</Badge>
					{/each}
				</div>
			</div>
		</Card.Content>
	</Card.Root>

	<TelegramSection
		bind:telegramId
		currentTelegramId={$user?.telegramId}
		saving={savingTelegram}
		success={telegramSuccess}
		error={telegramError}
		onSave={saveTelegramId}
	/>

	<PasswordSection
		bind:currentPassword
		bind:newPassword
		bind:confirmPassword
		saving={savingPassword}
		error={passwordError}
		success={passwordSuccess}
		onChangePassword={changePassword}
	/>
</div>