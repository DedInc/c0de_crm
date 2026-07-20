<script lang="ts">
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Dialog from '$lib/components/ui/dialog';

	interface Permission {
		id: string;
		name: string;
		description: string | null;
	}

	interface Props {
		open: boolean;
		isEditing: boolean;
		isAdmin: boolean;
		formName: string;
		formDescription: string;
		formPermissionIds: string[];
		permissions: Permission[];
		submitting: boolean;
		formError: string;
		onSubmit: () => void;
		onClose: () => void;
		onTogglePermission: (permId: string) => void;
	}

	let {
		open = $bindable(),
		isEditing,
		isAdmin,
		formName = $bindable(),
		formDescription = $bindable(),
		formPermissionIds = $bindable(),
		permissions,
		submitting,
		formError,
		onSubmit,
		onClose,
		onTogglePermission
	}: Props = $props();
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title>
				{isEditing ? $t('roles.editRole') : $t('roles.newRole')}
			</Dialog.Title>
		</Dialog.Header>

		<div class="space-y-4 py-4">
			{#if formError}
				<div class="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
					{formError}
				</div>
			{/if}

			<div class="space-y-2">
				<Label for="name">{$t('roles.roleName')}</Label>
				<Input
					id="name"
					bind:value={formName}
					placeholder={$t('roles.roleName')}
					disabled={isAdmin}
				/>
			</div>

			<div class="space-y-2">
				<Label for="description">{$t('roles.description')}</Label>
				<Textarea
					id="description"
					bind:value={formDescription}
					placeholder={$t('roles.description')}
					rows={2}
				/>
			</div>

			<div class="space-y-2">
				<Label>{$t('roles.permissions')}</Label>
				<div class="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
					{#each permissions as perm}
						<div class="flex items-start gap-2">
							<Checkbox
								id="perm-{perm.id}"
								checked={formPermissionIds.includes(perm.id)}
								onCheckedChange={() => onTogglePermission(perm.id)}
							/>
							<div class="grid gap-0.5">
								<label for="perm-{perm.id}" class="text-sm font-medium cursor-pointer">
									{$t(`permission.${perm.name}`)}
								</label>
								{#if perm.description}
									<span class="text-xs text-muted-foreground">{perm.description}</span>
								{/if}
							</div>
						</div>
					{/each}
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