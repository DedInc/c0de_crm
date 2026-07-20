<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';

	interface Props {
		currentPassword: string;
		newPassword: string;
		confirmPassword: string;
		saving: boolean;
		error: string;
		success: boolean;
		onChangePassword: () => void;
	}

	let {
		currentPassword = $bindable(),
		newPassword = $bindable(),
		confirmPassword = $bindable(),
		saving,
		error,
		success,
		onChangePassword
	}: Props = $props();
</script>

<Card.Root>
	<Card.Header>
		<Card.Title>{$t('profile.changePassword')}</Card.Title>
	</Card.Header>
	<Card.Content>
		<div class="space-y-4">
			{#if error}
				<div class="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
					{error}
				</div>
			{/if}

			{#if success}
				<div class="p-3 text-sm text-success bg-success/10 rounded-md">
					{$t('success.updated')}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="currentPassword">{$t('profile.currentPassword')}</Label>
				<Input id="currentPassword" type="password" bind:value={currentPassword} />
			</div>

			<div class="space-y-2">
				<Label for="newPassword">{$t('profile.newPassword')}</Label>
				<Input id="newPassword" type="password" bind:value={newPassword} />
			</div>

			<div class="space-y-2">
				<Label for="confirmPassword">{$t('profile.confirmPassword')}</Label>
				<Input id="confirmPassword" type="password" bind:value={confirmPassword} />
			</div>

			<Button onclick={onChangePassword} disabled={saving}>
				{$t('profile.changePassword')}
			</Button>
		</div>
	</Card.Content>
</Card.Root>