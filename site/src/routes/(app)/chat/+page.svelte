<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Send from '@lucide/svelte/icons/send';
	import ImageIcon from '@lucide/svelte/icons/image';
	import X from '@lucide/svelte/icons/x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import { OrdersList, MessagesList } from '$lib/components/chat';
	import { RealtimeManager } from '$lib/utils/realtime';

	interface Order {
		id: string;
		title: string;
		status: string;
		customerName: string | null;
		customerTelegramId: string;
	}

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

	let orders = $state<Order[]>([]);
	let selectedOrderId = $state<string | null>(null);
	let messages = $state<Message[]>([]);
	let newMessage = $state('');
	let loading = $state(true);
	let loadingMessages = $state(false);
	let sendingMessage = $state(false);
	let messagesContainer = $state<HTMLDivElement | null>(null);
	let selectedImages = $state<File[]>([]);
	let imagePreviewUrls = $state<string[]>([]);
	let fileInputRef = $state<HTMLInputElement | null>(null);

	let realtimeManager: RealtimeManager | null = null;

	onMount(async () => {
		try {
			orders = await trpc.chat.getOrdersWithChat.query();

			const urlOrderId = $page.url.searchParams.get('order');
			if (urlOrderId) {
				selectedOrderId = urlOrderId;
				await loadMessages(urlOrderId);
				startRealTimeUpdates(urlOrderId);
			}
		} catch (e) {
			console.error('Failed to load orders:', e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		realtimeManager?.stop();
	});

	function startRealTimeUpdates(orderId: string) {
		realtimeManager?.stop();

		realtimeManager = new RealtimeManager({
			sseUrl: `/api/chat/events?orderId=${orderId}`,
			onMessage: (data: unknown) => {
				const typedData = data as { type: string; message?: Message };
				if (typedData.type === 'new_message' && typedData.message) {
					const exists = messages.some((m) => m.id === typedData.message!.id);
					if (!exists) {
						messages = [...messages, typedData.message];
						scrollToBottom();
					}
				}
			}
		});

		realtimeManager.start(async () => {
			await pollMessages(orderId);
		});
	}

	async function pollMessages(orderId: string) {
		try {
			const newMessages = await trpc.chat.getMessages.query({ orderId });
			if (
				newMessages.length !== messages.length ||
				(newMessages.length > 0 &&
					messages.length > 0 &&
					newMessages[newMessages.length - 1].id !== messages[messages.length - 1].id)
			) {
				messages = newMessages;
				scrollToBottom();
			}
		} catch (e) {
			console.error('Failed to poll messages:', e);
		}
	}

	async function loadMessages(orderId: string) {
		loadingMessages = true;
		try {
			messages = await trpc.chat.getMessages.query({ orderId });
			scrollToBottom();
		} catch (e) {
			console.error('Failed to load messages:', e);
		} finally {
			loadingMessages = false;
		}
	}

	async function selectOrder(orderId: string) {
		selectedOrderId = orderId;
		await loadMessages(orderId);
		startRealTimeUpdates(orderId);
	}

	async function sendMessage() {
		if ((!newMessage.trim() && selectedImages.length === 0) || !selectedOrderId) return;

		sendingMessage = true;
		try {
			let imageUrls: string[] | undefined;
			
			// If there are images, upload them first
			if (selectedImages.length > 0) {
				imageUrls = await Promise.all(selectedImages.map(uploadImage));
			}

			await trpc.chat.sendMessage.mutate({
				orderId: selectedOrderId,
				message: newMessage.trim(),
				imageUrls
			});
			newMessage = '';
			clearSelectedImages();
			await loadMessages(selectedOrderId);
		} catch (e) {
			console.error('Failed to send message:', e);
		} finally {
			sendingMessage = false;
		}
	}

	async function compressImage(file: File, maxWidth: number = 1200, quality: number = 0.7): Promise<string> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			
			img.onload = () => {
				// Calculate new dimensions while maintaining aspect ratio
				let width = img.width;
				let height = img.height;
				
				if (width > maxWidth) {
					height = (height * maxWidth) / width;
					width = maxWidth;
				}
				
				canvas.width = width;
				canvas.height = height;
				
				// Draw and compress
				ctx?.drawImage(img, 0, 0, width, height);
				
				// Convert to base64 with compression
				const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
				resolve(compressedDataUrl);
			};
			
			img.onerror = reject;
			
			// Create object URL to load the image
			img.src = URL.createObjectURL(file);
		});
	}

	async function uploadImage(file: File): Promise<string> {
		// Compress image before converting to base64
		// This significantly reduces the payload size
		try {
			return await compressImage(file, 1200, 0.7);
		} catch {
			// Fallback to original if compression fails
			return new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as string);
				reader.onerror = reject;
				reader.readAsDataURL(file);
			});
		}
	}

	function handleImageSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const files = input.files;
		if (files && files.length > 0) {
			for (const file of Array.from(files)) {
				// Validate file type
				if (!file.type.startsWith('image/')) {
					alert('Please select image files only');
					continue;
				}
				// Validate file size (max 5MB per image)
				if (file.size > 5 * 1024 * 1024) {
					alert(`Image "${file.name}" is too large. Max size is 5MB.`);
					continue;
				}
				// Limit to 10 images
				if (selectedImages.length >= 10) {
					alert('Maximum 10 images allowed');
					break;
				}
				selectedImages = [...selectedImages, file];
				imagePreviewUrls = [...imagePreviewUrls, URL.createObjectURL(file)];
			}
		}
	}

	function removeImage(index: number) {
		URL.revokeObjectURL(imagePreviewUrls[index]);
		selectedImages = selectedImages.filter((_, i) => i !== index);
		imagePreviewUrls = imagePreviewUrls.filter((_, i) => i !== index);
	}

	function clearSelectedImages() {
		imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
		selectedImages = [];
		imagePreviewUrls = [];
		if (fileInputRef) {
			fileInputRef.value = '';
		}
	}

	function triggerImageSelect() {
		fileInputRef?.click();
	}

	function scrollToBottom() {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 100);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	// Cleanup on destroy
	onDestroy(() => {
		imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
	});

	$effect(() => {
		if (messagesContainer) {
			scrollToBottom();
		}
	});
</script>

<div class="h-[calc(100vh-8rem)] flex flex-col">
	<h1 class="text-3xl font-bold mb-6">{$t('chat.title')}</h1>

	{#if loading}
		<div class="flex items-center justify-center flex-1">
			<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
		</div>
	{:else}
		<div class="flex-1 flex gap-4 min-h-0">
			<OrdersList {orders} {selectedOrderId} onSelectOrder={selectOrder} />

			<!-- Chat area -->
			<Card.Root class="flex-1 flex flex-col min-w-0">
				{#if !selectedOrderId}
					<div class="flex-1 flex items-center justify-center">
						<div class="text-center text-muted-foreground">
							<MessageSquare class="h-12 w-12 mx-auto mb-4 opacity-50" />
							<p>{$t('chat.selectOrder')}</p>
						</div>
					</div>
				{:else}
					<Card.Header class="pb-2 border-b">
						{@const selectedOrder = orders.find((o) => o.id === selectedOrderId)}
						{#if selectedOrder}
							<div class="flex items-center justify-between">
								<div>
									<Card.Title class="text-lg">{selectedOrder.title}</Card.Title>
									<p class="text-sm text-muted-foreground">
										{selectedOrder.customerName || selectedOrder.customerTelegramId}
									</p>
								</div>
								<a href="/orders/{selectedOrderId}">
									<Button variant="outline" size="sm">
										{$t('orders.orderDetails')}
									</Button>
								</a>
							</div>
						{/if}
					</Card.Header>

					<MessagesList
						{messages}
						loading={loadingMessages}
						bind:containerRef={messagesContainer}
					/>

					<!-- Input -->
					<div class="p-4 border-t">
						{#if imagePreviewUrls.length > 0}
							<div class="mb-2 flex flex-wrap gap-2">
								{#each imagePreviewUrls as previewUrl, index}
									<div class="relative inline-block">
										<img
											src={previewUrl}
											alt="Selected {index + 1}"
											class="max-h-24 rounded border"
										/>
										<button
											type="button"
											class="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
											onclick={() => removeImage(index)}
										>
											<X class="h-3 w-3" />
										</button>
									</div>
								{/each}
							</div>
						{/if}
						<div class="flex gap-2">
							<input
								type="file"
								accept="image/*"
								multiple
								class="hidden"
								bind:this={fileInputRef}
								onchange={handleImageSelect}
							/>
							<Button
								variant="outline"
								size="icon"
								onclick={triggerImageSelect}
								disabled={sendingMessage || selectedImages.length >= 10}
								title={$t('chat.attachImage')}
							>
								<ImageIcon class="h-4 w-4" />
							</Button>
							<Input
								bind:value={newMessage}
								placeholder={$t('chat.typeMessage')}
								onkeydown={handleKeydown}
								disabled={sendingMessage}
								class="flex-1"
							/>
							<Button onclick={sendMessage} disabled={sendingMessage || (!newMessage.trim() && selectedImages.length === 0)}>
								<Send class="h-4 w-4" />
							</Button>
						</div>
					</div>
				{/if}
			</Card.Root>
		</div>
	{/if}
</div>