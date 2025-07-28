import type { IStorage } from "./storage";

export interface IModel {
  id: string; // Unique identifier for the model
  apikey: string; // API key for the model
  model: string; // Model name or identifier
  baseUrl: string; // Base URL for the model API
}

class ModelStorage implements IStorage<IModel> {
  private db: IDBDatabase;

  constructor(db: IDBDatabase) {
    this.db = db;
  }

  async store(values: IModel[]): Promise<void> {
    const transaction = this.db.transaction('focus-fox-models', 'readwrite');
    const store = transaction.objectStore('focus-fox-models');
    values.forEach(value => store.put(value));
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async load(upperBoundId?: string, limit?: number): Promise<IModel[]> {
    const transaction = this.db.transaction('focus-fox-models', 'readonly');
    const store = transaction.objectStore('focus-fox-models');
    if (!upperBoundId) {
      const query = store.index('id').getAll(undefined, limit);
      return new Promise((resolve, reject) => {
        query.onsuccess = (event: Event) => resolve((event.target as IDBRequest).result.value);
        query.onerror = (event) => reject(event);
      });
    }

    const query = store.index('id').openCursor(IDBKeyRange.upperBound(upperBoundId), 'prev');

    return new Promise((resolve, reject) => {
      const results: IModel[] = [];
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

export async function createModelStorage(): Promise<ModelStorage> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('focus-fox', 1);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('focus-fox-models')) {
        db.createObjectStore('focus-fox-models', { keyPath: 'id' });
      }
    };
    request.onsuccess = (event) => {
      resolve(new ModelStorage((event.target as IDBOpenDBRequest).result));
    };
    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}
