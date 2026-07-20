<script lang="ts">
	import { t } from '$lib/i18n';
	import { Button } from '$lib/components/ui/button';
	import * as Select from '$lib/components/ui/select';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';

	interface Props {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		pageSize: number;
		pageSizeOptions?: number[];
		onPageChange: (page: number) => void;
		onPageSizeChange?: (size: number) => void;
	}

	let {
		currentPage,
		totalPages,
		totalItems,
		pageSize,
		pageSizeOptions = [10, 20, 50, 100],
		onPageChange,
		onPageSizeChange
	}: Props = $props();

	let from = $derived((currentPage - 1) * pageSize + 1);
	let to = $derived(Math.min(currentPage * pageSize, totalItems));

	function goToPrevious() {
		if (currentPage > 1) {
			onPageChange(currentPage - 1);
		}
	}

	function goToNext() {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1);
		}
	}

	function handlePageSizeChange(value: string) {
		if (onPageSizeChange) {
			onPageSizeChange(parseInt(value));
		}
	}
</script>

<div class="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
	<div class="text-sm text-muted-foreground">
		{$t('pagination.showing', { from, to, total: totalItems })}
	</div>

	<div class="flex items-center gap-4">
		{#if onPageSizeChange}
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted-foreground">{$t('pagination.perPage')}:</span>
				<Select.Root type="single" value={pageSize.toString()} onValueChange={handlePageSizeChange}>
					<Select.Trigger class="w-20">
						{pageSize}
					</Select.Trigger>
					<Select.Content>
						{#each pageSizeOptions as size}
							<Select.Item value={size.toString()}>{size}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		{/if}

		<div class="flex items-center gap-2">
			<Button
				variant="outline"
				size="icon"
				onclick={goToPrevious}
				disabled={currentPage <= 1}
			>
				<ChevronLeft class="h-4 w-4" />
			</Button>

			<span class="text-sm min-w-[100px] text-center">
				{$t('pagination.page', { current: currentPage, total: totalPages })}
			</span>

			<Button
				variant="outline"
				size="icon"
				onclick={goToNext}
				disabled={currentPage >= totalPages}
			>
				<ChevronRight class="h-4 w-4" />
			</Button>
		</div>
	</div>
</div>