<script lang="ts">
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Badge } from '$lib/components/ui/badge';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Role {
		id: string;
		name: string;
	}

	interface Marker {
		id: string;
		name: string;
		color: string;
	}

	interface Props {
		open: boolean;
		isEditing: boolean;
		formUsername: string;
		formPassword: string;
		formTelegramId: string;
		formRoleIds: string[];
		formMarkerIds: string[];
		roles: Role[];
		markers: Marker[];
		submitting: boolean;
		formError: string;
		onSubmit: () => void;
		onClose: () => void;
		onToggleRole: (roleId: string) => void;
		onToggleMarker: (markerId: string) => void;
	}

	let {
		open = $bindable(),
		isEditing,
		formUsername = $bindable(),
		formPassword = $bindable(),
		formTelegramId = $bindable(),
		formRoleIds = $bindable(),
		formMarkerIds = $bindable(),
		roles,
		markers,
		submitting,
		formError,
		onSubmit,
		onClose,
		onToggleRole,
		onToggleMarker
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{isEditing ? $t('users.editUser') : $t('users.newUser')}
			</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if formError}
				<div class="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
					{formError}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="username">{$t('users.username')}</Label>
				<Input id="username" bind:value={formUsername} placeholder={$t('users.username')} />
			</div>

			<div class="space-y-2">
				<Label for="password">
					{$t('users.password')}
					{#if isEditing}
						<span class="text-muted-foreground text-xs">(leave empty to keep current)</span>
					{/if}
				</Label>
				<Input
					id="password"
					type="password"
					bind:value={formPassword}
					placeholder={$t('users.password')}
				/>
			</div>

			<div class="space-y-2">
				<Label for="telegramId">{$t('users.telegramId')}</Label>
				<Input
					id="telegramId"
					bind:value={formTelegramId}
					placeholder={$t('users.telegramId')}
				/>
			</div>

			<div class="space-y-2">
				<Label>{$t('users.roles')}</Label>
				<div class="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
					{#each roles as role}
						<div class="flex items-center gap-2">
							<Checkbox
								id="role-{role.id}"
								checked={formRoleIds.includes(role.id)}
								onCheckedChange={() => onToggleRole(role.id)}
							/>
							<label for="role-{role.id}" class="text-sm cursor-pointer">
								{role.name}
							</label>
						</div>
					{/each}
				</div>
			</div>

			<div class="space-y-2">
				<Label>{$t('users.stackMarkers')}</Label>
				<div class="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
					{#if markers.length === 0}
						<p class="text-sm text-muted-foreground">{$t('markers.noMarkers')}</p>
					{:else}
						{#each markers as marker}
							<div class="flex items-center gap-2">
								<Checkbox
									id="marker-{marker.id}"
									checked={formMarkerIds.includes(marker.id)}
									onCheckedChange={() => onToggleMarker(marker.id)}
								/>
								<label for="marker-{marker.id}" class="text-sm cursor-pointer flex items-center gap-2">
									<Badge 
										variant="outline" 
										style="border-color: {marker.color}; color: {marker.color};"
									>
										{marker.name}
									</Badge>
								</label>
							</div>
						{/each}
					{/if}
				</div>
			</div>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{$t('common.cancel')}
			</Button>
			<Button onclick={onSubmit} disabled={submitting}>
				{$t('common.save')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>