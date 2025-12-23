<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Table from '$lib/components/ui/table';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import { UserFormDialog, DeleteUserDialog } from '$lib/components/users';
	import { createUserFormManager } from '$lib/utils/user-form-manager.svelte';

	interface Marker {
		id: string;
		name: string;
		color: string;
	}

	interface User {
		id: string;
		username: string;
		telegramId: string | null;
		roles: { roleId: string; roleName: string }[];
		markers: Marker[];
	}

	interface Role {
		id: string;
		name: string;
	}

	let users = $state<User[]>([]);
	let roles = $state<Role[]>([]);
	let allMarkers = $state<Marker[]>([]);
	let loading = $state(true);

	let showDialog = $state(false);
	let submitting = $state(false);
	let showDeleteDialog = $state(false);
	let deletingUser = $state<User | null>(null);

	const formManager = createUserFormManager();

	onMount(async () => {
		await loadData();
	});

	async function loadData() {
		try {
			const [usersData, rolesData, markersData] = await Promise.all([
				trpc.users.list.query(),
				trpc.roles.list.query(),
				trpc.markers.list.query()
			]);
			users = usersData;
			roles = rolesData;
			allMarkers = markersData;
		} catch (e) {
			console.error('Failed to load data:', e);
		} finally {
			loading = false;
		}
	}

	function openCreateDialog() {
		formManager.openCreateForm();
		showDialog = true;
	}

	function openEditDialog(user: User) {
		formManager.openEditForm(user);
		showDialog = true;
	}

	async function handleSubmit() {
		const validationError = formManager.validateForm();
		if (validationError) {
			formManager.formError = validationError;
			return;
		}

		submitting = true;

		try {
			const formData = formManager.getFormData();
			
			if (formManager.editingUser) {
				await trpc.users.update.mutate({
					id: formManager.editingUser.id,
					...formData
				});
			} else {
				await trpc.users.create.mutate({
					username: formData.username,
					password: formData.password!,
					roleIds: formData.roleIds,
					telegramId: formData.telegramId || undefined,
					markerIds: formData.markerIds
				});
			}

			showDialog = false;
			await loadData();
		} catch (e: unknown) {
			formManager.formError = (e as Error).message || 'Failed to save user';
		} finally {
			submitting = false;
		}
	}

	function confirmDelete(user: User) {
		deletingUser = user;
		showDeleteDialog = true;
	}

	async function handleDelete() {
		if (!deletingUser) return;

		try {
			await trpc.users.delete.mutate({ id: deletingUser.id });
			showDeleteDialog = false;
			deletingUser = null;
			await loadData();
		} catch (e) {
			console.error('Failed to delete user:', e);
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">{$t('users.title')}</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="h-4 w-4 mr-2" />
			{$t('users.newUser')}
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if users.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">{$t('users.noUsers')}</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<Card.Root>
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>{$t('users.username')}</Table.Head>
						<Table.Head>{$t('users.roles')}</Table.Head>
						<Table.Head>{$t('users.stackMarkers')}</Table.Head>
						<Table.Head>{$t('users.telegramId')}</Table.Head>
						<Table.Head class="text-right">{$t('common.actions')}</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each users as user}
						<Table.Row>
							<Table.Cell class="font-medium">{user.username}</Table.Cell>
							<Table.Cell>
								<div class="flex flex-wrap gap-1">
									{#each user.roles as role}
										<Badge variant="secondary">{role.roleName}</Badge>
									{/each}
								</div>
							</Table.Cell>
							<Table.Cell>
								<div class="flex flex-wrap gap-1">
									{#each user.markers.slice(0, 3) as marker}
										<Badge
											variant="outline"
											style="border-color: {marker.color}; color: {marker.color};"
										>
											{marker.name}
										</Badge>
									{/each}
									{#if user.markers.length > 3}
										<Badge variant="outline">+{user.markers.length - 3}</Badge>
									{/if}
								</div>
							</Table.Cell>
							<Table.Cell>
								{#if user.telegramId}
									<Badge variant="outline" class="text-success">
										{user.telegramId}
									</Badge>
								{:else}
									<span class="text-muted-foreground">-</span>
								{/if}
							</Table.Cell>
							<Table.Cell class="text-right">
								<div class="flex justify-end gap-2">
									<Button variant="ghost" size="icon" onclick={() => openEditDialog(user)}>
										<Pencil class="h-4 w-4" />
									</Button>
									<Button variant="ghost" size="icon" onclick={() => confirmDelete(user)}>
										<Trash2 class="h-4 w-4 text-destructive" />
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</Card.Root>
	{/if}
</div>

<!-- Create/Edit Dialog -->
<UserFormDialog
	bind:open={showDialog}
	isEditing={!!formManager.editingUser}
	bind:formUsername={formManager.formUsername}
	bind:formPassword={formManager.formPassword}
	bind:formTelegramId={formManager.formTelegramId}
	bind:formRoleIds={formManager.formRoleIds}
	bind:formMarkerIds={formManager.formMarkerIds}
	{roles}
	markers={allMarkers}
	{submitting}
	formError={formManager.formError}
	onSubmit={handleSubmit}
	onClose={() => (showDialog = false)}
	onToggleRole={formManager.toggleRole}
	onToggleMarker={formManager.toggleMarker}
/>

<!-- Delete Confirmation Dialog -->
<DeleteUserDialog
	bind:open={showDeleteDialog}
	onDelete={handleDelete}
	onClose={() => (showDeleteDialog = false)}
/>