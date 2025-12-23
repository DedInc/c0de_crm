<script lang="ts">
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import { browser } from '$app/environment';
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Plus from '@lucide/svelte/icons/plus';
	import MessageSquare from '@lucide/svelte/icons/message-square';

	interface Props {
		open: boolean;
		orderId: string;
		assignedUserId?: string;
		onClose: () => void;
	}

	interface OrderPermission {
		id: string;
		orderId: string;
		userId: string;
		permission: string;
		grantedById: string;
		expiresAt: string | null;
		createdAt: string;
		user?: { id: string; username: string };
		grantedBy?: { id: string; username: string };
	}

	let { open = $bindable(), orderId, assignedUserId, onClose }: Props = $props();

	let permissions = $state<OrderPermission[]>([]);
	let loading = $state(true);
	let granting = $state(false);
	let error = $state('');

	$effect(() => {
		if (browser && open) {
			loadPermissions();
		}
	});

	async function loadPermissions() {
		loading = true;
		error = '';
		try {
			permissions = await trpc.orders.getOrderPermissions.query({ orderId });
		} catch (e: unknown) {
			error = (e as Error).message || 'Failed to load permissions';
		} finally {
			loading = false;
		}
	}

	async function grantChatPermission() {
		if (!assignedUserId) return;
		granting = true;
		error = '';
		try {
			await trpc.orders.grantOrderPermission.mutate({
				orderId,
				userId: assignedUserId,
				permission: 'chat_customers'
			});
			await loadPermissions();
		} catch (e: unknown) {
			error = (e as Error).message || 'Failed to grant permission';
		} finally {
			granting = false;
		}
	}

	async function revokePermission(permissionId: string) {
		try {
			await trpc.orders.revokeOrderPermission.mutate({ permissionId });
			await loadPermissions();
		} catch (e: unknown) {
			error = (e as Error).message || 'Failed to revoke permission';
		}
	}

	function assignedUserHasChatPermission(): boolean {
		if (!assignedUserId) return false;
		return permissions.some(
			(p) => p.userId === assignedUserId && p.permission === 'chat_customers'
		);
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && onClose()}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>{$t('orders.managePermissions')}</Dialog.Title>
			<Dialog.Description>
				{$t('orders.permissionsDescription')}
			</Dialog.Description>
		</Dialog.Header>

		{#if error}
			<div class="p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>
		{/if}

		<div class="space-y-4">
			{#if loading}
				<div class="flex items-center justify-center py-8">
					<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
				</div>
			{:else}
				{#if assignedUserId && !assignedUserHasChatPermission()}
					<div class="p-4 border rounded-lg bg-muted/50">
						<p class="text-sm font-medium mb-2">{$t('orders.grantChatAccess')}</p>
						<p class="text-xs text-muted-foreground mb-3">
							{$t('orders.grantChatAccessDescription')}
						</p>
						<Button size="sm" onclick={grantChatPermission} disabled={granting}>
							<Plus class="h-4 w-4 mr-2" />
							{granting ? $t('common.loading') : $t('orders.grantChatPermission')}
						</Button>
					</div>
				{/if}

				<div class="space-y-2">
					<h4 class="text-sm font-medium">{$t('orders.currentPermissions')}</h4>
					{#if permissions.length === 0}
						<p class="text-sm text-muted-foreground py-4 text-center">
							{$t('orders.noPermissions')}
						</p>
					{:else}
						{#each permissions as permission}
							<div class="flex items-center justify-between p-3 border rounded-lg">
								<div class="flex items-center gap-3">
									<MessageSquare class="h-4 w-4 text-muted-foreground" />
									<div>
										<p class="text-sm font-medium">
											{permission.user?.username || 'Unknown'}
										</p>
										<p class="text-xs text-muted-foreground">
											{$t('orders.grantedBy')}: {permission.grantedBy?.username || 'Unknown'}
										</p>
									</div>
								</div>
								<div class="flex items-center gap-2">
									<Badge variant="outline">
										{$t(`permission.${permission.permission}`)}
									</Badge>
									<Button
										variant="ghost"
										size="icon"
										class="h-8 w-8 text-destructive hover:text-destructive"
										onclick={() => revokePermission(permission.id)}
									>
										<Trash2 class="h-4 w-4" />
									</Button>
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>
				{$t('common.close')}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>