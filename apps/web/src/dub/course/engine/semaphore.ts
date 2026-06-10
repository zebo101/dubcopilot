// Async counting semaphore — the engine's only concurrency primitive.
// FIFO fairness; waiters can be cancelled via AbortSignal (rejects AbortError).

export class AbortError extends Error {
	constructor(message = "Aborted") {
		super(message);
		this.name = "AbortError";
	}
}

interface Waiter {
	resolve: () => void;
	reject: (err: Error) => void;
	signal?: AbortSignal;
	onAbort?: () => void;
}

export class Semaphore {
	private permits: number;
	private waiters: Waiter[] = [];

	constructor(count: number) {
		if (count < 1) throw new Error("Semaphore needs >= 1 permit");
		this.permits = count;
	}

	acquire(signal?: AbortSignal): Promise<void> {
		if (signal?.aborted) return Promise.reject(new AbortError());
		if (this.permits > 0) {
			this.permits--;
			return Promise.resolve();
		}
		return new Promise<void>((resolve, reject) => {
			const waiter: Waiter = { resolve, reject, signal };
			if (signal) {
				waiter.onAbort = () => {
					const i = this.waiters.indexOf(waiter);
					if (i !== -1) this.waiters.splice(i, 1);
					reject(new AbortError());
				};
				signal.addEventListener("abort", waiter.onAbort, { once: true });
			}
			this.waiters.push(waiter);
		});
	}

	release(): void {
		const next = this.waiters.shift();
		if (next) {
			if (next.signal && next.onAbort) {
				next.signal.removeEventListener("abort", next.onAbort);
			}
			next.resolve();
			return;
		}
		this.permits++;
	}

	/** Run fn while holding a permit; always releases, even on throw. */
	async withPermit<T>(fn: () => Promise<T>, signal?: AbortSignal): Promise<T> {
		await this.acquire(signal);
		try {
			return await fn();
		} finally {
			this.release();
		}
	}
}
