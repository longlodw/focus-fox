import { type IStorage } from "./storage";

export interface IMessage {
  id: string; // Unique identifier for the message
  roomId: string; // Identifier for the chat room this message belongs to
  role: "user" | "assistant" | "system"; // Indicates who sent the message
  content: string; // The actual message content
  timestamp: number; // Unix timestamp of when the message was sent
  selectedTexts?: string[]; // Optional array of selected texts, if any
}

class MessagesStorage implements IStorage<IMessage> {
  private roomId: string;
  private db: IDBDatabase

  constructor(roomId: string, db: IDBDatabase) {
    this.roomId = roomId;
    this.db = db;
  }
  async store(values: IMessage[]): Promise<void> {
    const transaction = this.db.transaction('focus-fox-messages', 'readwrite');
    const store = transaction.objectStore('focus-fox-messages');
    values.forEach(value => {
      if (value.roomId !== this.roomId) {
        throw new Error(`Message roomId ${value.roomId} does not match storage roomId ${this.roomId}`);
      }
      store.put(value);
    });
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async load(upperBoundId?: string, limit?: number): Promise<IMessage[]> {
    const transaction = this.db.transaction('focus-fox-messages', 'readonly');
    const store = transaction.objectStore('focus-fox-messages');
    if (!upperBoundId) {
      const query = store.index('roomId_id').getAll(this.roomId, limit);
      return new Promise((resolve, reject) => {
        query.onsuccess = (event: Event) => resolve((event.target as IDBRequest).result.value);
        query.onerror = (event) => reject(event);
      });
    }

    const query = store.index('roomId_id').openCursor(IDBKeyRange.upperBound([this.roomId, upperBoundId]), 'prev');

    return new Promise((resolve, reject) => {
      const results: IMessage[] = [];
      query.onsuccess = (event: Event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          results.push(cursor.value);
          if (limit && results.length < limit) {
            cursor.continue();
          } else {
            resolve(results.reverse());
          }
        } else {
          resolve(results.reverse());
        }
      };
      query.onerror = (event) => reject(event);
    });
  }
}

export async function createMessagesStorage(roomId: string): Promise<MessagesStorage> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('focus-fox-messages');
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('focus-fox-messages')) {
        const store = db.createObjectStore('focus-fox-messages', { keyPath: 'id' });
        store.createIndex('roomId_id', ['roomId', 'id'], { unique: true });
      }
    };
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(new MessagesStorage(roomId, db));
    };
    request.onerror = (event) => reject(event);
  });
}
