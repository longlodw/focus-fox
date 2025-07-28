export interface IStorage<T> {
  store(values: T[]): Promise<void>;
  load(upperBoundId?: string, limit?: number): Promise<T[]>;
}
