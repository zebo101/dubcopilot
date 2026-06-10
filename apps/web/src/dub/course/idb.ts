// Tiny IndexedDB key-value store for course-batch state. Used to persist the
// course metadata AND the picked FileSystemDirectoryHandle (handles are
// structured-cloneable, so they survive a reload — enabling 断点续传 / resume).
// The connection is opened once and reused — opening/closing per call caused
// an IDB churn storm under frequent progress writes (review IMP-1).

const DB_NAME = "opencut-dub-course";
const STORE = "kv";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, VERSION);
		req.onupgradeneeded = () => {
			if (!req.result.objectStoreNames.contains(STORE)) {
				req.result.createObjectStore(STORE);
			}
		};
		req.onsuccess = () => {
			const db = req.result;
			// if the browser closes it (version change elsewhere), reconnect lazily
			db.onclose = () => {
				dbPromise = null;
			};
			resolve(db);
		};
		req.onerror = () => {
			dbPromise = null;
			reject(req.error);
		};
	});
	return dbPromise;
}

export async function idbGet<T>(key: string): Promise<T | null> {
	if (typeof indexedDB === "undefined") return null;
	const db = await openDb();
	return new Promise<T | null>((resolve, reject) => {
		const tx = db.transaction(STORE, "readonly");
		const req = tx.objectStore(STORE).get(key);
		req.onsuccess = () => resolve((req.result as T) ?? null);
		req.onerror = () => reject(req.error);
	});
}

export async function idbSet(key: string, value: unknown): Promise<void> {
	if (typeof indexedDB === "undefined") return;
	const db = await openDb();
	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).put(value, key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}

export async function idbDel(key: string): Promise<void> {
	if (typeof indexedDB === "undefined") return;
	const db = await openDb();
	return new Promise<void>((resolve, reject) => {
		const tx = db.transaction(STORE, "readwrite");
		tx.objectStore(STORE).delete(key);
		tx.oncomplete = () => resolve();
		tx.onerror = () => reject(tx.error);
	});
}
