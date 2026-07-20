<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { RoleFormDialog, DeleteRoleDialog } from '$lib/components/roles';

	interface Permission {
		id: string;
		name: string;
		description: string | null;
	}

	interface Role {
		id: string;
		name: string;
		description: string | null;
		permissions: { permissionId: string; permissionName: string }[];
	}

	let roles = $state<Role[]>([]);
	let permissions = $state<Permission[]>([]);
	let loading = $state(true);

	let showDialog = $state(false);
	let editingRole = $state<Role | null>(null);
	let formName = $state('');
	let formDescription = $state('');
	let formPermissionIds = $state<string[]>([]);
	let submitting = $state(false);
	let formError = $state('');

	let showDeleteDialog = $state(false);
	let deletingRole = $state<Role | null>(null);

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		try {
			const [rolesData, permsData] = await Promise.all([
				trpc.roles.list.query(),
				trpc.permissions.list.query()
			]);
			roles = rolesData;
			permissions = permsData;
		} catch (e) {
			console.error('Failed to load data:', e);
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		editingRole = null;
		formName = '';
		formDescription = '';
		formPermissionIds = [];
		formError = '';
		showDialog = true;
	}

	function openEditDialog(role: Role) {
		editingRole = role;
		formName = role.name;
		formDescription = role.description || '';
		formPermissionIds = role.permissions.map((p) => p.permissionId);
		formError = '';
		showDialog = true;
	}

	function togglePermission(permId: string) {
		if (formPermissionIds.includes(permId)) {
			formPermissionIds = formPermissionIds.filter((id) => id !== permId);
		} else {
			formPermissionIds = [...formPermissionIds, permId];
		}
	}

	async function handleSubmit() {
		formError = '';

		if (!formName.trim()) {
			formError = 'Role name is required';
			return;
		}

		submitting = true;

		try {
			if (editingRole) {
				await trpc.roles.update.mutate({
					id: editingRole.id,
					name: formName,
					description: formDescription || null,
					permissionIds: formPermissionIds
				});
			} else {
				await trpc.roles.create.mutate({
					name: formName,
					description: formDescription || undefined,
					permissionIds: formPermissionIds
				});
			}

			showDialog = false;
			await loadData();
		} catch (e: unknown) {
			formError = (e as Error).message || 'Failed to save role';
		} finally {
			submitting = false;
		}
	}

	function confirmDelete(role: Role) {
		deletingRole = role;
		showDeleteDialog = true;
	}

	async function handleDelete() {
		if (!deletingRole) return;

		try {
			await trpc.roles.delete.mutate({ id: deletingRole.id });
			showDeleteDialog = false;
			deletingRole = null;
			await loadData();
		} catch (e) {
			console.error('Failed to delete role:', e);
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">{$t('roles.title')}</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="h-4 w-4 mr-2" />
			{$t('roles.newRole')}
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if roles.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">{$t('roles.noRoles')}</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each roles as role}
				<Card.Root>
					<Card.Header>
						<div class="flex items-start justify-between">
							<div>
								<Card.Title>{role.name}</Card.Title>
								{#if role.description}
									<Card.Description>{role.description}</Card.Description>
								{/if}
							</div>
							<div class="flex gap-1">
								<Button variant="ghost" size="icon" onclick={() => openEditDialog(role)}>
									<Pencil class="h-4 w-4" />
								</Button>
								{#if role.name !== 'Administrator'}
									<Button variant="ghost" size="icon" onclick={() => confirmDelete(role)}>
										<Trash2 class="h-4 w-4 text-destructive" />
									</Button>
								{/if}
							</div>
						</div>
					</Card.Header>
					<Card.Content>
						<div class="space-y-2">
							<p class="text-sm font-medium">{$t('roles.permissions')}:</p>
							<div class="flex flex-wrap gap-1">
								{#each role.permissions as perm}
									<Badge variant="outline" class="text-xs">
										{$t(`permission.${perm.permissionName}`)}
									</Badge>
								{/each}
								{#if role.permissions.length === 0}
									<span class="text-muted-foreground text-sm">{$t('common.none')}</span>
								{/if}
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<RoleFormDialog
	bind:open={showDialog}
	isEditing={!!editingRole}
	isAdmin={editingRole?.name === 'Administrator'}
	bind:formName
	bind:formDescription
	bind:formPermissionIds
	{permissions}
	{submitting}
	{formError}
	onSubmit={handleSubmit}
	onClose={() => (showDialog = false)}
	onTogglePermission={togglePermission}
/>

<DeleteRoleDialog
	bind:open={showDeleteDialog}
	onDelete={handleDelete}
	onClose={() => (showDeleteDialog = false)}
/>