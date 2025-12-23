import { RealtimeManager } from './realtime';

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

interface ChatManagerOptions {
	onMessagesUpdate: (messages: Message[]) => void;
	fetchMessages: (orderId: string) => Promise<Message[]>;
}

export function createChatManager(options: ChatManagerOptions) {
	let realtimeManager: RealtimeManager | null = null;
	let messages = $state<Message[]>([]);

	function startRealTimeUpdates(orderId: string, messagesContainer: HTMLDivElement | null) {
		realtimeManager?.stop();

		realtimeManager = new RealtimeManager({
			sseUrl: `/api/chat/events?orderId=${orderId}`,
			onMessage: (data: unknown) => {
				const typedData = data as { type: string; message?: Message };
				if (typedData.type === 'new_message' && typedData.message) {
					const exists = messages.some((m) => m.id === typedData.message!.id);
					if (!exists) {
						messages = [...messages, typedData.message];
						options.onMessagesUpdate(messages);
						scrollToBottom(messagesContainer);
					}
				}
			}
		});

		realtimeManager.start(async () => {
			await pollMessages(orderId, messagesContainer);
		});
	}

	async function pollMessages(orderId: string, messagesContainer: HTMLDivElement | null) {
		try {
			const newMessages = await options.fetchMessages(orderId);
			if (
				newMessages.length !== messages.length ||
				(newMessages.length > 0 &&
					messages.length > 0 &&
					newMessages[newMessages.length - 1].id !== messages[messages.length - 1].id)
			) {
				messages = newMessages;
				options.onMessagesUpdate(messages);
				scrollToBottom(messagesContainer);
			}
		} catch (e) {
		// eslint-disable-next-line no-console
		console.error('Failed to poll messages:', e);
	}
}

async function loadMessages(orderId: string, messagesContainer: HTMLDivElement | null): Promise<void> {
	try {
		messages = await options.fetchMessages(orderId);
		options.onMessagesUpdate(messages);
		scrollToBottom(messagesContainer);
	} catch (e) {
		// eslint-disable-next-line no-console
		console.error('Failed to load messages:', e);
	}
}

	function scrollToBottom(messagesContainer: HTMLDivElement | null) {
		setTimeout(() => {
			if (messagesContainer) {
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
			}
		}, 100);
	}

	function stop() {
		realtimeManager?.stop();
	}

	return {
		get messages() { return messages },
		set messages(value: Message[]) { messages = value },
		startRealTimeUpdates,
		loadMessages,
		scrollToBottom,
		stop
	};
}
