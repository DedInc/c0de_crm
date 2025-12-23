/**
 * Real-time updates manager using SSE with polling fallback
 */

export interface RealtimeConfig {
	sseUrl: string;
	pollingIntervalMs?: number;
	heartbeatTimeoutMs?: number;
	onMessage: (data: unknown) => void;
	onConnectionChange?: (connected: boolean) => void;
}

export class RealtimeManager {
	private eventSource: EventSource | null = null;
	private pollingInterval: ReturnType<typeof setInterval> | null = null;
	private lastHeartbeat: number = Date.now();
	private sseConnected: boolean = false;
	private config: Required<RealtimeConfig>;
	private pollFn: (() => Promise<void>) | null = null;

	constructor(config: RealtimeConfig) {
		this.config = {
			pollingIntervalMs: 2000,
			heartbeatTimeoutMs: 30000,
			onConnectionChange: () => {},
			...config
		};
	}

	start(pollFn: () => Promise<void>) {
		this.pollFn = pollFn;
		this.stop();
		this.connectSSE();
		this.startPolling();
	}

	stop() {
		this.disconnectSSE();
		this.stopPolling();
	}

	private connectSSE() {
		this.disconnectSSE();

		try {
			this.eventSource = new EventSource(this.config.sseUrl);

			this.eventSource.onopen = () => {
				this.sseConnected = true;
				this.lastHeartbeat = Date.now();
				this.config.onConnectionChange(true);
			};

			this.eventSource.onmessage = (event) => {
				try {
					const data = JSON.parse(event.data);
					this.lastHeartbeat = Date.now();

					if (data.type === 'connected' || data.type === 'heartbeat') {
						this.sseConnected = true;
						return;
					}

					this.config.onMessage(data);
				} catch {
					// Ignore parse errors
				}
			};

			this.eventSource.onerror = () => {
				this.sseConnected = false;
				this.config.onConnectionChange(false);
				this.disconnectSSE();
				// Reconnect after a short delay
				setTimeout(() => {
					this.connectSSE();
				}, 2000);
			};
		} catch {
			this.sseConnected = false;
			this.config.onConnectionChange(false);
		}
	}

	private disconnectSSE() {
		if (this.eventSource) {
			this.eventSource.close();
			this.eventSource = null;
		}
		this.sseConnected = false;
	}

	private startPolling() {
		this.stopPolling();
		this.pollingInterval = setInterval(async () => {
			const timeSinceHeartbeat = Date.now() - this.lastHeartbeat;
			const sseIsHealthy = this.sseConnected && timeSinceHeartbeat < this.config.heartbeatTimeoutMs;

			// Skip polling if SSE is healthy
			if (sseIsHealthy || !this.pollFn) {
				return;
			}

			await this.pollFn();
		}, this.config.pollingIntervalMs);
	}

	private stopPolling() {
		if (this.pollingInterval) {
			clearInterval(this.pollingInterval);
			this.pollingInterval = null;
		}
	}

	get isConnected(): boolean {
		return this.sseConnected;
	}
}

/**
 * Format time for display
 */
export function formatTime(dateStr: string): string {
	return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format date for display
 */
export function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString();
}

/**
 * Format full date and time
 */
export function formatDateTime(date: string): string {
	return new Date(date).toLocaleString();
}

/**
 * Get status color class
 */
export function getStatusColor(status: string): string {
	const colors: Record<string, string> = {
		pending_moderation: 'status-pending_moderation',
		rejected: 'status-rejected',
		approved: 'status-approved',
		in_progress: 'status-in_progress',
		testing: 'status-testing',
		completed: 'status-completed',
		delivered: 'status-delivered'
	};
	return colors[status] || 'bg-muted text-muted-foreground';
}