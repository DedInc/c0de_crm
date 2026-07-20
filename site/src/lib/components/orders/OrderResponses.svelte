<script lang="ts">
	import { t } from '$lib/i18n';
	import * as Card from '$lib/components/ui/card';
	import { Badge } from '$lib/components/ui/badge';
	import { formatDateTime } from '$lib/utils/realtime';

	interface Marker {
		id: string;
		name: string;
		color: string;
	}

	interface Response {
		id: string;
		proposedPrice: number;
		message: string | null;
		createdAt: string;
		user?: { id: string; username: string; markers?: Marker[] };
	}

	interface Props {
		responses: Response[];
	}

	let { responses }: Props = $props();
</script>

{#if responses.length > 0}
	<Card.Root>
		<Card.Header>
			<Card.Title>{$t('orders.responses')} ({responses.length})</Card.Title>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				{#each responses as response}
					<div class="p-4 border rounded-lg">
						<div class="flex items-center justify-between mb-2">
							<span class="font-medium">{response.user?.username || 'Unknown'}</span>
							<span class="text-lg font-bold">${response.proposedPrice}</span>
						</div>
						{#if response.user?.markers && response.user.markers.length > 0}
							<div class="flex flex-wrap gap-1 mb-2">
								{#each response.user.markers as marker}
									<Badge
										variant="outline"
										style="border-color: {marker.color}; color: {marker.color};"
									>
										{marker.name}
									</Badge>
								{/each}
							</div>
						{/if}
						{#if response.message}
							<p class="text-muted-foreground">{response.message}</p>
						{/if}
						<p class="text-xs text-muted-foreground mt-2">
							{formatDateTime(response.createdAt)}
						</p>
					</div>
				{/each}
			</div>
		</Card.Content>
	</Card.Root>
{/if}