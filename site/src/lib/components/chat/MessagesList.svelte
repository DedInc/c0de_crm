<script lang="ts">
	import { t } from '$lib/i18n';
	import { Separator } from '$lib/components/ui/separator';
	import { ImageLightbox } from '$lib/components/ui/image-lightbox';

	interface FileAttachment {
		url: string;
		name: string;
		type: string;
	}

	interface Message {
		id: string;
		orderId: string;
		senderId: string | null;
		senderType: string;
		message: string;
		imageUrls?: string | string[] | null;
		fileUrls?: FileAttachment[] | string | null;
		createdAt: string;
		senderName: string | null;
	}

	interface Props {
		messages: Message[];
		loading: boolean;
		containerRef?: HTMLDivElement | null;
	}

	let { messages, loading, containerRef = $bindable(null) }: Props = $props();

	let lightboxOpen = $state(false);
	let lightboxImages = $state<string[]>([]);
	let lightboxIndex = $state(0);

	function formatTime(dateStr: string): string {
		return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString();
	}

	function openLightbox(images: string[], index: number) {
		lightboxImages = images;
		lightboxIndex = index;
		lightboxOpen = true;
	}

	function resolveImageUrl(url: string, orderId: string): string {
		if (url.startsWith('tg-file:') || url.startsWith('r2:')) {
			return `/api/chat/telegram-image?path=${encodeURIComponent(url)}&orderId=${encodeURIComponent(orderId)}`;
		}
		return url;
	}

	function resolveFileUrl(url: string, orderId: string): string {
		if (url.startsWith('tg-file:') || url.startsWith('r2:')) {
			return `/api/chat/telegram-image?path=${encodeURIComponent(url)}&orderId=${encodeURIComponent(orderId)}`;
		}
		return url;
	}

	function getImageUrls(imageUrls: string | string[] | null | undefined, orderId: string): string[] {
		if (!imageUrls) return [];
		let urls: string[];
		if (Array.isArray(imageUrls)) {
			urls = imageUrls;
		} else {
			try {
				const parsed = JSON.parse(imageUrls);
				urls = Array.isArray(parsed) ? parsed : [imageUrls];
			} catch {
				urls = [imageUrls];
			}
		}
		return urls.map((url) => resolveImageUrl(url, orderId));
	}

	function getFileAttachments(fileUrls: FileAttachment[] | string | null | undefined): FileAttachment[] {
		if (!fileUrls) return [];
		if (Array.isArray(fileUrls)) return fileUrls;
		try {
			const parsed = JSON.parse(fileUrls);
			return Array.isArray(parsed) ? parsed : [];
		} catch {
			return [];
		}
	}

	function getFileIcon(type: string): string {
		if (type.includes('pdf')) return '📄';
		if (type.includes('word') || type.includes('document')) return '📝';
		if (type.includes('excel') || type.includes('sheet')) return '📊';
		if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
		if (type.includes('zip') || type.includes('rar') || type.includes('7z') || type.includes('tar') || type.includes('gzip')) return '📦';
		if (type.includes('text/plain')) return '📄';
		return '📎';
	}
</script>

<div bind:this={containerRef} class="flex-1 overflow-y-auto p-4 space-y-4 chat-scrollbar">
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
			{@const images = getImageUrls(message.imageUrls, message.orderId)}
			{@const files = getFileAttachments(message.fileUrls)}

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
							{#each images as imageUrl, imgIdx}
								<button
									type="button"
									class="block cursor-pointer rounded overflow-hidden hover:opacity-90 transition-opacity"
									onclick={() => openLightbox(images, imgIdx)}
								>
									<img
										src={imageUrl}
										alt=""
										class="max-w-full max-h-48 rounded object-contain"
										loading="lazy"
									/>
								</button>
							{/each}
						</div>
					{/if}
					{#if files.length > 0}
						<div class="flex flex-col gap-1 mb-2">
							{#each files as file}
								<a
									href={resolveFileUrl(file.url, message.orderId)}
									target="_blank"
									rel="noopener noreferrer"
									download={file.name}
									class="inline-flex items-center gap-2 rounded px-2 py-1 text-sm bg-background/20 hover:bg-background/30 transition-colors"
								>
									<span>{getFileIcon(file.type)}</span>
									<span class="truncate max-w-[200px]">{file.name}</span>
								</a>
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

<ImageLightbox
	images={lightboxImages}
	initialIndex={lightboxIndex}
	bind:open={lightboxOpen}
	onClose={() => { lightboxOpen = false; }}
/>
