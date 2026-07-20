<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import Check from '@lucide/svelte/icons/check';
	import AlertCircle from '@lucide/svelte/icons/alert-circle';

	interface Props {
		telegramId: string;
		currentTelegramId: string | null | undefined;
		saving: boolean;
		success: boolean;
		error: string;
		onSave: () => void;
	}

	let {
		telegramId = $bindable(),
		currentTelegramId,
		saving,
		success,
		error,
		onSave
	}: Props = $props();

	// Validate Telegram ID format (should be numeric, typically 9-10 digits)
	function isValidTelegramId(id: string): boolean {
		if (!id || id.trim() === '') return true; // Empty is valid (unlinking)
		return /^\d{7,10}$/.test(id.trim());
	}

	let validationError = $derived(
		telegramId && !isValidTelegramId(telegramId) ? $t('profile.invalidTelegramId') : ''
	);

	// Check if the ID is already linked to current user (no need to save again)
	let isAlreadyLinked = $derived(
		telegramId.trim() !== '' && telegramId.trim() === (currentTelegramId || '')
	);

	let canSave = $derived(
		!saving && !isAlreadyLinked && (telegramId === '' || isValidTelegramId(telegramId))
	);
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{$t('profile.linkTelegram')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			<div class="space-y-2">
				<Label for="telegramId">{$t('users.telegramId')}</Label>
				<div class="flex gap-2">
					<Input
						id="telegramId"
						bind:value={telegramId}
						placeholder="1234567890"
						class={validationError || error ? 'border-destructive' : ''}
					/>
					<Button onclick={onSave} disabled={!canSave}>
						{#if success}
							<Check class="h-4 w-4 mr-2" />
						{/if}
						{$t('profile.verifyAndSave')}
					</Button>
				</div>
				{#if validationError}
					<p class="text-sm text-destructive flex items-center gap-1">
						<AlertCircle class="h-4 w-4" />
						{validationError}
					</p>
				{:else if error}
					<p class="text-sm text-destructive flex items-center gap-1">
						<AlertCircle class="h-4 w-4" />
						{error}
					</p>
				{:else if isAlreadyLinked}
					<p class="text-sm text-success flex items-center gap-1">
						<Check class="h-4 w-4" />
						{$t('profile.telegramAlreadyLinked')}
					</p>
				{:else}
					<p class="text-sm text-muted-foreground">
						{currentTelegramId ? $t('profile.telegramLinked') : $t('profile.telegramNotLinked')}
					</p>
				{/if}
				<p class="text-xs text-muted-foreground">
					{$t('profile.telegramIdHint')}
				</p>
			</div>
		</div>
	</Card.Content>
</Card.Root>