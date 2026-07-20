<script lang="ts">
	interface Props {
		variant?: 'cards' | 'table' | 'list';
		count?: number;
	}

	let { variant = 'cards', count = 4 }: Props = $props();
</script>

{#if variant === 'cards'}
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		{#each Array(count) as _}
			<div class="rounded-xl border bg-card p-6 animate-pulse">
				<div class="h-4 w-24 bg-muted rounded mb-3"></div>
				<div class="h-8 w-16 bg-muted rounded mb-2"></div>
				<div class="h-3 w-32 bg-muted rounded"></div>
			</div>
		{/each}
	</div>
{:else if variant === 'table'}
	<div class="rounded-xl border bg-card animate-pulse">
		<div class="p-4 border-b">
			<div class="h-4 w-48 bg-muted rounded"></div>
		</div>
		{#each Array(count) as _}
			<div class="p-4 border-b flex gap-4">
				<div class="h-4 w-1/4 bg-muted rounded"></div>
				<div class="h-4 w-1/3 bg-muted rounded"></div>
				<div class="h-4 w-16 bg-muted rounded"></div>
				<div class="h-4 w-20 bg-muted rounded"></div>
			</div>
		{/each}
	</div>
{:else}
	<div class="space-y-3 animate-pulse">
		{#each Array(count) as _}
			<div class="rounded-lg border bg-card p-4 flex gap-3">
				<div class="h-10 w-10 bg-muted rounded-full flex-shrink-0"></div>
				<div class="flex-1">
					<div class="h-4 w-1/3 bg-muted rounded mb-2"></div>
					<div class="h-3 w-2/3 bg-muted rounded"></div>
				</div>
			</div>
		{/each}
	</div>
{/if}
