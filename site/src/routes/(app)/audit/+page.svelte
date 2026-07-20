<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import * as Select from '$lib/components/ui/select';
	import Search from '@lucide/svelte/icons/search';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { toastError } from '$lib/stores/toast.svelte';

	interface AuditLog {
		id: string;
		userId: string | null;
		action: string;
		targetType: string;
		targetId: string | null;
		details?: Record<string, unknown> | null;
		ipAddress: string | null;
		createdAt: Date | string;
		username: string | null;
	}

	interface AuditUser {
		id: string;
		username: string;
	}

	let logs = $state<AuditLog[]>([]);
	let actions = $state<string[]>([]);
	let users = $state<AuditUser[]>([]);
	let loading = $state(true);
	let total = $state(0);
	let page = $state(1);
	let perPage = $state(25);
	let totalPages = $state(0);

	let filterAction = $state('');
	let filterUserId = $state('');
	let filterSearch = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let expandedLogId = $state<string | null>(null);

	onMount(async () => {
		await Promise.all([loadFilters(), loadLogs()]);
	});

	async function loadFilters() {
		try {
			const [actionsResult, usersResult] = await Promise.all([
				trpc.audit.getActions.query(),
				trpc.audit.getUsers.query()
			]);
			actions = actionsResult;
			users = usersResult;
		} catch {
			toastError('Failed to load filters');
		}
	}

	async function loadLogs() {
		loading = true;
		try {
			const result = await trpc.audit.list.query({
				page,
				perPage,
				action: filterAction || undefined,
				userId: filterUserId || undefined,
				search: filterSearch || undefined,
				dateFrom: filterDateFrom || undefined,
				dateTo: filterDateTo || undefined
			});
			logs = result.logs;
			total = result.total;
			totalPages = result.totalPages;
		} catch {
			toastError('Failed to load audit logs');
		} finally {
			loading = false;
		}
	}

	function applyFilters() {
		page = 1;
		loadLogs();
	}

	function clearFilters() {
		filterAction = '';
		filterUserId = '';
		filterSearch = '';
		filterDateFrom = '';
		filterDateTo = '';
		page = 1;
		loadLogs();
	}

	function goToPage(p: number) {
		page = p;
		loadLogs();
	}

	function toggleExpand(id: string) {
		expandedLogId = expandedLogId === id ? null : id;
	}

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleString();
	}

	function getActionBadgeClass(action: string): string {
		if (action.startsWith('login.failed')) return 'bg-destructive/15 text-destructive';
		if (action.startsWith('login.')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-400';
		if (action.includes('.delete') || action.includes('.revoke') || action.includes('.unassign'))
			return 'bg-orange-500/15 text-orange-700 dark:text-orange-400';
		if (action.includes('.create') || action.includes('.grant') || action.includes('.assign'))
			return 'bg-green-500/15 text-green-700 dark:text-green-400';
		return 'bg-muted text-muted-foreground';
	}

	function formatDetails(details: Record<string, unknown> | null): string {
		if (!details) return '';
		return JSON.stringify(details, null, 2);
	}
</script>

<div class="space-y-6">
	<h1 class="text-3xl font-bold">{$t('audit.title')}</h1>

	<!-- Filters -->
	<Card.Root>
		<Card.Content class="pt-6">
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
				<div>
					<span class="text-sm font-medium mb-1 block">{$t('audit.filterAction')}</span>
					<Select.Root type="single" bind:value={filterAction}>
						<Select.Trigger class="w-full">
							{filterAction || $t('audit.allActions')}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">{$t('audit.allActions')}</Select.Item>
							{#each actions as action}
								<Select.Item value={action}>{action}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<span class="text-sm font-medium mb-1 block">{$t('audit.filterUser')}</span>
					<Select.Root type="single" bind:value={filterUserId}>
						<Select.Trigger class="w-full">
							{users.find((u) => u.id === filterUserId)?.username || $t('audit.allUsers')}
						</Select.Trigger>
						<Select.Content>
							<Select.Item value="">{$t('audit.allUsers')}</Select.Item>
							{#each users as user}
								<Select.Item value={user.id}>{user.username}</Select.Item>
							{/each}
						</Select.Content>
					</Select.Root>
				</div>

				<div>
					<label for="filter-date-from" class="text-sm font-medium mb-1 block">{$t('audit.filterDateFrom')}</label>
					<Input id="filter-date-from" type="date" bind:value={filterDateFrom} />
				</div>

				<div>
					<label for="filter-date-to" class="text-sm font-medium mb-1 block">{$t('audit.filterDateTo')}</label>
					<Input id="filter-date-to" type="date" bind:value={filterDateTo} />
				</div>

				<div>
					<label for="filter-search" class="text-sm font-medium mb-1 block">{$t('audit.search')}</label>
					<div class="relative">
						<Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							id="filter-search"
							bind:value={filterSearch}
							placeholder={$t('audit.searchPlaceholder')}
							class="pl-9"
							onkeydown={(e) => e.key === 'Enter' && applyFilters()}
						/>
					</div>
				</div>
			</div>

			<div class="flex gap-2 mt-4">
				<Button onclick={applyFilters}>{$t('audit.apply')}</Button>
				<Button variant="outline" onclick={clearFilters}>{$t('audit.clearFilters')}</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Results -->
	<Card.Root>
		<Card.Header>
			<div class="flex items-center justify-between">
				<Card.Title>{$t('audit.logs')}</Card.Title>
				<span class="text-sm text-muted-foreground">
					{$t('pagination.showing', { from: (page - 1) * perPage + 1, to: Math.min(page * perPage, total), total })}
				</span>
			</div>
		</Card.Header>
		<Card.Content>
			{#if loading}
				<div class="flex items-center justify-center py-12">
					<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
				</div>
			{:else if logs.length === 0}
				<p class="text-center text-muted-foreground py-12">{$t('audit.noLogs')}</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full text-sm">
						<thead>
							<tr class="border-b">
								<th class="text-left py-3 px-2 font-medium">{$t('audit.colTime')}</th>
								<th class="text-left py-3 px-2 font-medium">{$t('audit.colUser')}</th>
								<th class="text-left py-3 px-2 font-medium">{$t('audit.colAction')}</th>
								<th class="text-left py-3 px-2 font-medium">{$t('audit.colTarget')}</th>
								<th class="text-left py-3 px-2 font-medium">{$t('audit.colIp')}</th>
								<th class="text-left py-3 px-2 font-medium"></th>
							</tr>
						</thead>
						<tbody>
							{#each logs as log}
								<tr class="border-b hover:bg-muted/50 transition-colors">
									<td class="py-3 px-2 whitespace-nowrap">{formatDate(log.createdAt)}</td>
									<td class="py-3 px-2">{log.username || '—'}</td>
									<td class="py-3 px-2">
										<span class="inline-block px-2 py-0.5 rounded text-xs font-medium {getActionBadgeClass(log.action)}">
											{log.action}
										</span>
									</td>
									<td class="py-3 px-2">
										<span class="text-muted-foreground">{log.targetType}</span>
										{#if log.targetId}
											<span class="text-xs ml-1 font-mono">{log.targetId.slice(0, 8)}…</span>
										{/if}
									</td>
									<td class="py-3 px-2 font-mono text-xs">{log.ipAddress || '—'}</td>
									<td class="py-3 px-2">
										{#if log.details}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => toggleExpand(log.id)}
											>
												{expandedLogId === log.id ? $t('audit.collapse') : $t('audit.expand')}
											</Button>
										{/if}
									</td>
								</tr>
								{#if expandedLogId === log.id && log.details}
									<tr>
										<td colspan="6" class="px-2 pb-3">
											<pre class="bg-muted p-3 rounded text-xs overflow-x-auto max-h-64">{formatDetails(log.details)}</pre>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex items-center justify-between mt-4">
						<Button
							variant="outline"
							size="sm"
							disabled={page <= 1}
							onclick={() => goToPage(page - 1)}
						>
							<ChevronLeft class="h-4 w-4 mr-1" />
							{$t('pagination.previous')}
						</Button>
						<span class="text-sm text-muted-foreground">
							{$t('pagination.page', { current: page, total: totalPages })}
						</span>
						<Button
							variant="outline"
							size="sm"
							disabled={page >= totalPages}
							onclick={() => goToPage(page + 1)}
						>
							{$t('pagination.next')}
							<ChevronRight class="h-4 w-4 ml-1" />
						</Button>
					</div>
				{/if}
			{/if}
		</Card.Content>
	</Card.Root>
</div>
