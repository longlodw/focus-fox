import { type IStorage } from "./storage";

export interface IRoom {
  id: string;
  name: string;
  createdAt: number; // Unix timestamp of when the room was created
  updatedAt: number; // Unix timestamp of when the room was last updated
}

class RoomsStorage implements IStorage<IRoom> {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async store(values: IRoom[]): Promise<void> {
    const transaction = this.db.transaction('focus-fox-rooms', 'readwrite');
    const store = transaction.objectStore('focus-fox-rooms');
    values.forEach(value => store.put(value));
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async load(upperBoundId?: string, limit?: number): Promise<IRoom[]> {
    const transaction = this.db.transaction('focus-fox-rooms', 'readonly');
    const store = transaction.objectStore('focus-fox-rooms');
    if (!upperBoundId) {
      const query = store.getAll(undefined, limit);
      return new Promise((resolve, reject) => {
        query.onsuccess = (event: Event) => resolve((event.target as IDBRequest).result.value);
        query.onerror = (event) => reject(event);
      });
    }

    const query = store.openCursor(IDBKeyRange.upperBound(upperBoundId), 'prev');

    return new Promise((resolve, reject) => {
      const results: IRoom[] = [];
      query.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          results.push(cursor.value);
          if (limit && results.length < limit) {
            cursor.continue();
          } else {
            resolve(results);
          }
        } else {
          resolve(results);
        }
      };
      query.onerror = (event) => reject(event);
    });
  }
}

export async function createRoomsStorage(): Promise<RoomsStorage> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('focus-fox-rooms');
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('focus-fox-rooms')) {
        db.createObjectStore('focus-fox-rooms', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(new RoomsStorage(db));
    };
    request.onerror = (event) => reject(event);
  });
}
