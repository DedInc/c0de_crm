<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Pagination } from '$lib/components/ui/pagination';
	import { MarkerFormDialog, DeleteMarkerDialog } from '$lib/components/markers';
	import Plus from '@lucide/svelte/icons/plus';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash2 from '@lucide/svelte/icons/trash-2';

	interface Marker {
		id: string;
		name: string;
		color: string;
	}

	let markers = $state<Marker[]>([]);
	let loading = $state(true);

	// Pagination state
	let currentPage = $state(1);
	let pageSize = $state(12);
	let totalPages = $derived(Math.ceil(markers.length / pageSize));
	
	// Derived state for displayed markers
	let displayedMarkers = $derived.by(() => {
		const start = (currentPage - 1) * pageSize;
		const end = start + pageSize;
		return markers.slice(start, end);
	});

	let showDialog = $state(false);
	let editingMarker = $state<Marker | null>(null);
	let formName = $state('');
	let formColor = $state('#3b82f6');
	let submitting = $state(false);
	let formError = $state('');

	let showDeleteDialog = $state(false);
	let deletingMarker = $state<Marker | null>(null);

	onMount(async () => {
		await loadMarkers();
	});

	async function loadMarkers() {
		try {
			markers = await trpc.markers.list.query();
		} catch (e) {
			console.error('Failed to load markers:', e);
		} finally {
			loading = false;
		}
	}

	function handlePageChange(page: number) {
		currentPage = page;
	}

	function handlePageSizeChange(size: number) {
		pageSize = size;
		currentPage = 1;
	}

	function openCreateDialog() {
		editingMarker = null;
		formName = '';
		formColor = '#3b82f6';
		formError = '';
		showDialog = true;
	}

	function openEditDialog(marker: Marker) {
		editingMarker = marker;
		formName = marker.name;
		formColor = marker.color;
		formError = '';
		showDialog = true;
	}

	async function handleSubmit() {
		formError = '';

		if (!formName.trim()) {
			formError = $t('markers.nameRequired');
			return;
		}

		if (!/^#[0-9a-fA-F]{6}$/.test(formColor)) {
			formError = $t('markers.invalidColor');
			return;
		}

		submitting = true;

		try {
			if (editingMarker) {
				// Optimistic update for edit
				markers = markers.map(m =>
					m.id === editingMarker!.id
						? { ...m, name: formName, color: formColor }
						: m
				);
				
				await trpc.markers.update.mutate({
					id: editingMarker.id,
					name: formName,
					color: formColor
				});
			} else {
				// Optimistic update for create
				const tempId = crypto.randomUUID();
				const newMarker = { id: tempId, name: formName, color: formColor };
				markers = [...markers, newMarker];
				
				const result = await trpc.markers.create.mutate({
					name: formName,
					color: formColor
				});
				
				// Update with real ID
				markers = markers.map(m => m.id === tempId ? { ...m, id: result.id } : m);
			}

			showDialog = false;
		} catch (e: any) {
			formError = e.message || $t('markers.saveFailed');
			// Reload on error to revert optimistic update
			await loadMarkers();
		} finally {
			submitting = false;
		}
	}

	function confirmDelete(marker: Marker) {
		deletingMarker = marker;
		showDeleteDialog = true;
	}

	async function handleDelete() {
		if (!deletingMarker) return;

		const markerToDelete = deletingMarker;
		
		// Optimistic update
		markers = markers.filter(m => m.id !== markerToDelete.id);
		showDeleteDialog = false;
		deletingMarker = null;

		try {
			await trpc.markers.delete.mutate({ id: markerToDelete.id });
		} catch (e: any) {
			console.error('Failed to delete marker:', e);
			// Reload on error to revert optimistic update
			await loadMarkers();
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<h1 class="text-3xl font-bold">{$t('markers.title')}</h1>
		<Button onclick={openCreateDialog}>
			<Plus class="h-4 w-4 mr-2" />
			{$t('markers.newMarker')}
		</Button>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else if markers.length === 0}
		<Card.Root>
			<Card.Content class="py-12 text-center">
				<p class="text-muted-foreground">{$t('markers.noMarkers')}</p>
			</Card.Content>
		</Card.Root>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each displayedMarkers as marker}
				<Card.Root>
					<Card.Content class="pt-6">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-3">
								<div
									class="w-8 h-8 rounded-full border-2"
									style="background-color: {marker.color}; border-color: {marker.color}"
								></div>
								<span class="font-medium">{marker.name}</span>
							</div>
							<div class="flex gap-1">
								<Button variant="ghost" size="icon" onclick={() => openEditDialog(marker)}>
									<Pencil class="h-4 w-4" />
								</Button>
								<Button variant="ghost" size="icon" onclick={() => confirmDelete(marker)}>
									<Trash2 class="h-4 w-4 text-destructive" />
								</Button>
							</div>
						</div>
						<div class="mt-3">
							<Badge
								variant="outline"
								style="border-color: {marker.color}; color: {marker.color}"
							>
								{marker.name}
							</Badge>
						</div>
					</Card.Content>
				</Card.Root>
			{/each}
		</div>

		{#if totalPages > 1}
			<Pagination
				{currentPage}
				{totalPages}
				totalItems={markers.length}
				{pageSize}
				pageSizeOptions={[12, 24, 48]}
				onPageChange={handlePageChange}
				onPageSizeChange={handlePageSizeChange}
			/>
		{/if}
	{/if}
</div>

<MarkerFormDialog
	bind:open={showDialog}
	isEditing={!!editingMarker}
	bind:formName
	bind:formColor
	{submitting}
	{formError}
	onSubmit={handleSubmit}
	onClose={() => (showDialog = false)}
/>

<DeleteMarkerDialog
	bind:open={showDeleteDialog}
	onDelete={handleDelete}
	onClose={() => (showDeleteDialog = false)}
/>