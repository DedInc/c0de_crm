import type { Handle, HandleServerError } from '@sveltejs/kit';

function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

function getErrorStack(error: unknown): string | undefined {
	return error instanceof Error ? error.stack : undefined;
}

function writeLog(level: 'info' | 'error', payload: Record<string, unknown>): void {
	const line = JSON.stringify({
		level,
		time: new Date().toISOString(),
		...payload
	});

	if (level === 'error') {
		process.stderr.write(`${line}\n`);
		return;
	}

	process.stdout.write(`${line}\n`);
}

export const handle: Handle = async ({ event, resolve }) => {
	const startedAt = Date.now();
	const requestId = event.request.headers.get('x-request-id') || crypto.randomUUID();
	event.locals.requestId = requestId;

	const response = await resolve(event);
	response.headers.set('x-request-id', requestId);

	writeLog('info', {
		event: 'request',
		requestId,
		method: event.request.method,
		path: event.url.pathname,
		status: response.status,
		durationMs: Date.now() - startedAt,
		clientIp: event.getClientAddress()
	});

	return response;
};

export const handleError: HandleServerError = ({ error, event, status, message }) => {
	const requestId = event.locals.requestId || event.request.headers.get('x-request-id') || crypto.randomUUID();

	writeLog('error', {
		event: 'server_error',
		requestId,
		method: event.request.method,
		path: event.url.pathname,
		status,
		message,
		error: getErrorMessage(error),
		stack: getErrorStack(error)
	});

	return {
		message: 'Unexpected server error',
		requestId
	};
};
