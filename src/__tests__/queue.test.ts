import { DiskDeque } from "../index.js";
import fs from "fs";
import os from "os";
import path from "path";

describe("Disk persistent queue", () => {
  let deque: DiskDeque<number>;
  const directoryPath = path.join(os.tmpdir(), "testDir");

  beforeEach(() => {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath);
    }
    deque = new DiskDeque<number>(directoryPath);
  });

  afterEach(() => {
    fs.readdirSync(directoryPath).forEach((file) => {
      fs.unlinkSync(path.join(directoryPath, file));
    });
    fs.rmdirSync(directoryPath);
  });

  test("add should append to the deque and persist item", () => {
    const testItem = 1;
    deque.add(testItem);
    const walContent = deque.readWal();
    expect(walContent).toEqual([{ type: "add", item: testItem }]);
  });

  test("remove should remove item from the deque", () => {
    const testItem = 1;
    deque.add(testItem);
    const removedItem = deque.remove();
    const walContent = deque.readWal();
    expect(walContent).toEqual([
      { type: "add", item: testItem },
      { type: "remove", item: testItem },
    ]);
    expect(removedItem).toBe(testItem);
  });

  test("get should return the item at the specified offset", () => {
    const testItems = [1, 2, 3];
    testItems.forEach((item) => deque.add(item));
    const item = deque.get(1);
    expect(item).toBe(testItems[1]);
  });

  test("length should return the number of items in the deque", () => {
    const testItems = [1, 2, 3];
    testItems.forEach((item) => deque.add(item));
    expect(deque.length).toBe(testItems.length);
  });

  test("clear should remove all items from the deque", () => {
    const testItems = [1, 2, 3];
    testItems.forEach((item) => deque.add(item));
    deque.clear();
    const walContent = deque.readWal();
    expect(walContent).toEqual([
      { type: "add", item: testItems[0] },
      { type: "add", item: testItems[1] },
      { type: "add", item: testItems[2] },
      { type: "remove", item: testItems[0] },
      { type: "remove", item: testItems[1] },
      { type: "remove", item: testItems[2] },
    ]);
  });

  test("peekFront should return the first item in the deque", () => {
    const testItems = [1, 2, 3];
    testItems.forEach((item) => deque.add(item));
    const frontItem = deque.peekFront();
    expect(frontItem).toBe(testItems[0]);
    const walContent = deque.readWal();
    expect(walContent).toEqual([
      { type: "add", item: testItems[0] },
      { type: "add", item: testItems[1] },
      { type: "add", item: testItems[2] },
    ]);
  });

  test("peekBack should return the last item in the deque", () => {
    const testItems = [1, 2, 3];
    testItems.forEach((item) => deque.add(item));
    const backItem = deque.peekBack();
    expect(backItem).toBe(testItems[testItems.length - 1]);
    const walContent = deque.readWal();
    expect(walContent).toEqual([
      { type: "add", item: testItems[0] },
      { type: "add", item: testItems[1] },
      { type: "add", item: testItems[2] },
    ]);
  });

  test("newly created deque on existing folder should recover from WAL", () => {
    const testItems = [1, 2, 3];
    testItems.forEach((item) => deque.add(item));
    const newDeque = new DiskDeque<number>(directoryPath);
    expect(newDeque.length).toBe(testItems.length);
    expect(newDeque.peekFront()).toBe(testItems[0]);
    expect(newDeque.peekBack()).toBe(testItems[testItems.length - 1]);
  });
});
