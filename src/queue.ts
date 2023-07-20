import fs from "fs";
import path from "path";
import Deque from "double-ended-queue";
import { encode, decode } from "@msgpack/msgpack";

export class DiskDeque<T> {
  private deque: Deque<T>;
  private directoryPath: string;
  private walPath: string;
  private OPERATION_SEPARATOR = "\n";

  constructor(directoryPath: string) {
    this.deque = new Deque<T>();
    this.directoryPath = directoryPath;
    this.walPath = path.join(directoryPath, "queue.wal");
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
    }
    if (!fs.existsSync(this.walPath)) {
      fs.writeFileSync(this.walPath, "");
    }
    this.recoverFromWal();
  }

  get directory(): string {
    return this.directoryPath;
  }

  get length(): number {
    return this.deque.length;
  }

  push(item: T): void {
    this.deque.push(item);
    this.addToWal("add", item);
  }

  pop(): T {
    const item = this.deque.pop();
    if (item) {
      this.addToWal("remove", item);
    }
    return item;
  }

  shift(): T {
    const item = this.deque.shift();
    if (item) {
      this.addToWal("remove", item);
    }
    return item;
  }

  clear(): void {
    while (this.deque.length > 0) {
      this.shift();
    }
  }

  get(offset: number): T {
    return this.deque.get(offset);
  }

  add(item: T): void {
    this.push(item);
  }

  remove(): T {
    return this.shift();
  }

  peekFront(): T {
    return this.get(0);
  }

  peekBack(): T {
    return this.get(this.length - 1);
  }

  private recoverFromWal(): void {
    const operations = this.readWal();
    for (const operation of operations) {
      switch (operation.type) {
        case "add":
          this.deque.push(operation.item);
          break;
        case "remove":
          this.deque.shift();
          break;
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    }
  }

  public addToWal(type: "add" | "remove", item: T): void {
    const operation = { type, item };
    const data = encode(operation);
    const separator = this.isWalEmpty()
      ? new Uint8Array()
      : new TextEncoder().encode(this.OPERATION_SEPARATOR);
    fs.appendFileSync(this.walPath, separator);
    fs.appendFileSync(this.walPath, data);
  }

  public readWal(): Array<{ type: "add" | "remove"; item: T }> {
    if (fs.existsSync(this.walPath)) {
      const data = fs.readFileSync(this.walPath);
      if (data && data.length > 0) {
        const separator = new TextEncoder().encode(this.OPERATION_SEPARATOR);
        const operations: Array<{ type: "add" | "remove"; item: T }> = [];

        let start = 0;
        for (let i = 0; i < data.length; i++) {
          let foundSeparator = true;
          for (let j = 0; j < separator.length; j++) {
            if (data[i + j] !== separator[j]) {
              foundSeparator = false;
              break;
            }
          }

          if (foundSeparator) {
            const operationData = data.subarray(start, i);
            const operation = decode(operationData) as {
              type: "add" | "remove";
              item: T;
            };
            operations.push(operation);
            start = i + separator.length;
          }
        }

        // Handle the last operation (no separator after it)
        if (start < data.length) {
          const operationData = data.subarray(start);
          const operation = decode(operationData) as {
            type: "add" | "remove";
            item: T;
          };
          operations.push(operation);
        }

        return operations;
      }
    }
    return [];
  }

  private isWalEmpty(): boolean {
    try {
      const stats = fs.statSync(this.walPath);
      return stats.size === 0;
    } catch (err) {
      return true; // If file doesn't exist or other errors occur, assume it's empty
    }
  }
}
