<script lang="ts">
	import { t } from '$lib/i18n';
	import { Separator } from '$lib/components/ui/separator';

	interface Message {
		id: string;
		orderId: string;
		senderId: string | null;
		senderType: string;
		message: string;
		imageUrls?: string | string[] | null;
		createdAt: string;
		senderName: string | null;
	}

	interface Props {
		messages: Message[];
		loading: boolean;
		containerRef?: HTMLDivElement | null;
	}

	let { messages, loading, containerRef = $bindable(null) }: Props = $props();

	function formatTime(dateStr: string): string {
		return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString();
	}

	function openImageInNewTab(url: string) {
		window.open(url, '_blank');
	}

	function getImageUrls(imageUrls: string | string[] | null | undefined): string[] {
		if (!imageUrls) return [];
		if (Array.isArray(imageUrls)) return imageUrls;
		// Try to parse as JSON if it's a string
		try {
			const parsed = JSON.parse(imageUrls);
			return Array.isArray(parsed) ? parsed : [imageUrls];
		} catch {
			return [imageUrls];
		}
	}
</script>

<div bind:this={containerRef} class="flex-1 overflow-y-auto p-4 space-y-4">
	{#if loading}
		<div class="flex items-center justify-center py-8">
			<div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
		</div>
	{:else if messages.length === 0}
		<p class="text-center text-muted-foreground py-8">
			{$t('chat.noMessages')}
		</p>
	{:else}
		{#each messages as message, i}
			{@const prevMessage = messages[i - 1]}
			{@const showDate =
				!prevMessage || formatDate(message.createdAt) !== formatDate(prevMessage.createdAt)}
			{@const images = getImageUrls(message.imageUrls)}

			{#if showDate}
				<div class="flex items-center gap-4 my-4">
					<Separator class="flex-1" />
					<span class="text-xs text-muted-foreground">{formatDate(message.createdAt)}</span>
					<Separator class="flex-1" />
				</div>
			{/if}

			<div class="flex {message.senderType === 'staff' ? 'justify-end' : 'justify-start'}">
				<div
					class="max-w-[70%] {message.senderType === 'staff'
						? 'bg-primary text-primary-foreground'
						: 'bg-muted'} rounded-lg p-3"
				>
					<div class="flex items-center gap-2 mb-1">
						<span class="text-xs font-medium">
							{message.senderType === 'staff'
								? (message.senderName || $t('chat.staffMessage'))
								: $t('chat.customerMessage')}
						</span>
						<span class="text-xs opacity-70">{formatTime(message.createdAt)}</span>
					</div>
					{#if images.length > 0}
						<div class="flex flex-wrap gap-2 mb-2">
							{#each images as imageUrl}
								<button
									type="button"
									class="block cursor-pointer rounded overflow-hidden hover:opacity-90 transition-opacity"
									onclick={() => openImageInNewTab(imageUrl)}
								>
									<img
										src={imageUrl}
										alt=""
										class="max-w-full max-h-48 rounded object-contain"
									/>
								</button>
							{/each}
						</div>
					{/if}
					{#if message.message}
						<p class="text-sm whitespace-pre-wrap">{message.message}</p>
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>