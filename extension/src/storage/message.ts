export interface IMessage {
  id: string; // Unique identifier for the message
  roomId: string; // Identifier for the chat room this message belongs to
  sender: "user" | "assistant" | "system"; // Indicates who sent the message
  content: string; // The actual message content
  timestamp: number; // Unix timestamp of when the message was sent
  selectedTexts?: string[]; // Optional array of selected texts, if any
}

export interface IRoom {
  id: string;
  name: string;
  createdAt: number; // Unix timestamp of when the room was created
  updatedAt: number; // Unix timestamp of when the room was last updated
}

export interface IStorage<T> {
  store(values: T[]): Promise<void>;
  load(upperBoundId: string | null, limit: number): Promise<T[]>;
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

  async load(upperBoundId: string | null, limit: number): Promise<IMessage[]> {
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
          if (results.length < limit) {
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
