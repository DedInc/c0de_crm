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
	import { createImageUploader } from '$lib/utils/image-uploader.svelte';
	import { createChatManager } from '$lib/utils/chat-manager.svelte';

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

	const imageUploader = createImageUploader();
	const chatManager = createChatManager({
		onMessagesUpdate: (newMessages) => { messages = newMessages; },
		fetchMessages: (orderId) => trpc.chat.getMessages.query({ orderId })
	});

	onMount(async () => {
		try {
			orders = await trpc.chat.getOrdersWithChat.query();

			const urlOrderId = $page.url.searchParams.get('order');
			if (urlOrderId) {
				selectedOrderId = urlOrderId;
				loadingMessages = true;
				await chatManager.loadMessages(urlOrderId, messagesContainer);
				loadingMessages = false;
				chatManager.startRealTimeUpdates(urlOrderId, messagesContainer);
			}
		} catch (e) {
			console.error('Failed to load orders:', e);
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		chatManager.stop();
	});

	async function selectOrder(orderId: string) {
		selectedOrderId = orderId;
		loadingMessages = true;
		await chatManager.loadMessages(orderId, messagesContainer);
		loadingMessages = false;
		chatManager.startRealTimeUpdates(orderId, messagesContainer);
	}

	async function sendMessage() {
		if ((!newMessage.trim() && imageUploader.selectedImages.length === 0) || !selectedOrderId) return;

		sendingMessage = true;
		try {
			let imageUrls: string[] | undefined;
			
			if (imageUploader.selectedImages.length > 0) {
				imageUrls = await imageUploader.uploadAllImages();
			}

			await trpc.chat.sendMessage.mutate({
				orderId: selectedOrderId,
				message: newMessage.trim(),
				imageUrls
			});
			newMessage = '';
			imageUploader.clearSelectedImages();
			loadingMessages = true;
			await chatManager.loadMessages(selectedOrderId, messagesContainer);
			loadingMessages = false;
		} catch (e) {
			console.error('Failed to send message:', e);
		} finally {
			sendingMessage = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	$effect(() => {
		if (messagesContainer) {
			chatManager.scrollToBottom(messagesContainer);
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

					<div class="p-4 border-t">
						{#if imageUploader.imagePreviewUrls.length > 0}
							<div class="mb-2 flex flex-wrap gap-2">
								{#each imageUploader.imagePreviewUrls as previewUrl, index}
									<div class="relative inline-block">
										<img
											src={previewUrl}
											alt="Selected {index + 1}"
											class="max-h-24 rounded border"
										/>
										<button
											type="button"
											class="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
											onclick={() => imageUploader.removeImage(index)}
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
								bind:this={imageUploader.fileInputRef}
								onchange={imageUploader.handleImageSelect}
							/>
							<Button
								variant="outline"
								size="icon"
								onclick={imageUploader.triggerImageSelect}
								disabled={sendingMessage || imageUploader.selectedImages.length >= 10}
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
							<Button onclick={sendMessage} disabled={sendingMessage || (!newMessage.trim() && imageUploader.selectedImages.length === 0)}>
								<Send class="h-4 w-4" />
							</Button>
						</div>
					</div>
				{/if}
			</Card.Root>
		</div>
	{/if}
</div>
