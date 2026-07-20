<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { t } from '$lib/i18n';
	import { trpc } from '$lib/trpc/client';
	import * as Card from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Send from '@lucide/svelte/icons/send';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Paperclip from '@lucide/svelte/icons/paperclip';
	import X from '@lucide/svelte/icons/x';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import { OrdersList, MessagesList } from '$lib/components/chat';
	import { createImageUploader } from '$lib/utils/image-uploader.svelte';
	import { createFileUploader, FILE_ACCEPT } from '$lib/utils/file-uploader.svelte';
	import { createChatManager } from '$lib/utils/chat-manager.svelte';
	import { toastError } from '$lib/stores/toast.svelte';

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
	let showSidebar = $state(true);

	const imageUploader = createImageUploader();
	const fileUploader = createFileUploader();
	const chatManager = createChatManager({
		onMessagesUpdate: (newMessages) => { messages = newMessages; },
		fetchMessages: (orderId) => trpc.chat.getMessages.query({ orderId })
	});

	onMount(async () => {
		try {
			orders = await trpc.chat.getOrdersWithChat.query();

			const urlOrderId = page.url.searchParams.get('order');
			if (urlOrderId) {
				selectedOrderId = urlOrderId;
				showSidebar = false;
				loadingMessages = true;
				await chatManager.loadMessages(urlOrderId, messagesContainer);
				loadingMessages = false;
				chatManager.startRealTimeUpdates(urlOrderId, messagesContainer);
			}
		} catch {
			toastError('Failed to load chat orders');
		} finally {
			loading = false;
		}
	});

	onDestroy(() => {
		chatManager.stop();
	});

	async function selectOrder(orderId: string) {
		selectedOrderId = orderId;
		showSidebar = false;
		loadingMessages = true;
		await chatManager.loadMessages(orderId, messagesContainer);
		loadingMessages = false;
		chatManager.startRealTimeUpdates(orderId, messagesContainer);
	}

	function backToOrders() {
		showSidebar = true;
	}

	async function sendMessage() {
		if ((!newMessage.trim() && imageUploader.selectedImages.length === 0 && fileUploader.selectedFiles.length === 0) || !selectedOrderId) return;

		sendingMessage = true;
		try {
			let imageUrls: string[] | undefined;
			let fileUrls: { url: string; name: string; type: string }[] | undefined;
			
			if (imageUploader.selectedImages.length > 0) {
				imageUrls = await imageUploader.uploadAllImages(selectedOrderId);
			}

			if (fileUploader.selectedFiles.length > 0) {
				fileUrls = await fileUploader.uploadAllFiles(selectedOrderId);
			}

			await trpc.chat.sendMessage.mutate({
				orderId: selectedOrderId,
				message: newMessage.trim(),
				imageUrls,
				fileUrls
			});
			newMessage = '';
			imageUploader.clearSelectedImages();
			fileUploader.clearSelectedFiles();
			await chatManager.loadMessages(selectedOrderId, messagesContainer);
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to send message';
			toastError(message);
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

	function handlePaste(e: ClipboardEvent) {
		const files = Array.from(e.clipboardData?.items ?? [])
			.filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
			.map((item) => item.getAsFile())
			.filter((file): file is File => file !== null);

		if (files.length === 0) return;

		e.preventDefault();
		imageUploader.addImages(files);
	}

	$effect(() => {
		if (messagesContainer && messages.length) {
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
			<!-- Sidebar: visible on lg+ always; on mobile only when showSidebar -->
			<div class="{showSidebar ? 'flex' : 'hidden'} lg:flex flex-shrink-0">
				<OrdersList {orders} {selectedOrderId} onSelectOrder={selectOrder} />
			</div>

			<!-- Chat panel: visible on lg+ always; on mobile only when !showSidebar -->
			<div class="{!showSidebar ? 'flex' : 'hidden'} lg:flex flex-1 min-w-0">
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
								<div class="flex items-center justify-between gap-2">
									<div class="flex items-center gap-2 min-w-0">
										<button
											type="button"
											class="lg:hidden p-1 rounded hover:bg-muted"
											onclick={backToOrders}
										>
											<ArrowLeft class="h-5 w-5" />
										</button>
										<div class="min-w-0">
											<Card.Title class="text-lg truncate">{selectedOrder.title}</Card.Title>
											<p class="text-sm text-muted-foreground truncate">
												{selectedOrder.customerName || selectedOrder.customerTelegramId}
											</p>
										</div>
									</div>
									<a href="/orders/{selectedOrderId}" class="flex-shrink-0">
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
							{#if imageUploader.progress.uploading || fileUploader.progress.uploading}
								{@const activeProgress = imageUploader.progress.uploading ? imageUploader.progress : fileUploader.progress}
								<div class="mb-3 space-y-1.5">
									<div class="flex items-center justify-between text-xs text-muted-foreground">
										<span class="truncate max-w-[60%]">
											{imageUploader.progress.uploading ? '🖼️' : '📎'}
											{activeProgress.currentFileName}
											({activeProgress.currentFile}/{activeProgress.totalFiles})
										</span>
										<span class="font-medium">{activeProgress.overallProgress}%</span>
									</div>
									<div class="w-full bg-muted rounded-full h-2 overflow-hidden">
										<div
											class="bg-primary h-full rounded-full transition-all duration-200 ease-out"
											style="width: {activeProgress.overallProgress}%"
										></div>
									</div>
								</div>
							{/if}
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
							{#if fileUploader.selectedFiles.length > 0}
								<div class="mb-2 flex flex-wrap gap-2">
									{#each fileUploader.selectedFiles as sf, index}
										<div class="relative inline-flex items-center gap-1 rounded border bg-muted px-2 py-1 text-sm">
											<Paperclip class="h-3 w-3" />
											<span class="max-w-[120px] truncate">{sf.name}</span>
											<span class="text-muted-foreground text-xs">({fileUploader.formatFileSize(sf.size)})</span>
											<button
												type="button"
												class="ml-1 text-destructive hover:text-destructive/80"
												onclick={() => fileUploader.removeFile(index)}
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
								<input
									type="file"
									accept={FILE_ACCEPT}
									multiple
									class="hidden"
									bind:this={fileUploader.fileInputRef}
									onchange={fileUploader.handleFileSelect}
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
								<Button
									variant="outline"
									size="icon"
									onclick={fileUploader.triggerFileSelect}
									disabled={sendingMessage || fileUploader.selectedFiles.length >= 5}
									title={$t('chat.attachFile')}
								>
									<Paperclip class="h-4 w-4" />
								</Button>
								<Input
									bind:value={newMessage}
									placeholder={$t('chat.typeMessage')}
									onkeydown={handleKeydown}
									onpaste={handlePaste}
									disabled={sendingMessage}
									class="flex-1"
								/>
								<Button onclick={sendMessage} disabled={sendingMessage || (!newMessage.trim() && imageUploader.selectedImages.length === 0 && fileUploader.selectedFiles.length === 0)}>
									<Send class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{/if}
				</Card.Root>
			</div>
		</div>
	{/if}
</div>
