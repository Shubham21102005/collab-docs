import { type ID, idToString } from "./id.js";

export type Item = {
  id: ID;
  origin: ID | null; //null if item is first element
  content: string;
  deleted: boolean;
};

export type InsertOp = {
  type: "insert";
  id: ID;
  origin: ID | null;
  content: string;
};

export type Op = InsertOp;

function winSlotOver(a: ID, b: ID): boolean {
  if (a.clock !== b.clock) return a.clock > b.clock; //newer value must win always
  return a.client > b.client;
}

export class Doc {
  readonly client: string;

  private clock = 0;
  private items: Item[] = [];
  private byId = new Map<string, Item>(); //id-> item, for origin lookup

  constructor(client: string) {
    this.client = client;
  }

  toString(): string {
    let output = "";
    for (const item of this.items) {
      if (!item.deleted) output += item.content;
    }
    return output;
  }

  get length(): number {
    let n = 0;
    for (const item of this.items) if (!item.deleted) n++;
    return n;
  }

  insertAt(index: number, content: string): InsertOp {
    if (content.length !== 1) {
      throw new RangeError("inserAt takes exactly one character");
    }
    if (index < 0 || index > this.length) {
      throw new RangeError(`index ${index} put of range`);
    }

    const origin = index === 0 ? null : this.visibleItemAt(index - 1).id;

    this.clock += 1;
    const op: InsertOp = {
      type: "insert",
      id: { client: this.client, clock: this.clock },
      origin,
      content,
    };

    this.integrate(op);
    return op;
  }

  integrate(op: InsertOp): void {
    const key = idToString(op.id);
    if (this.byId.has(key)) return; //duplicate op

    this.clock = Math.max(this.clock, op.id.clock);

    let pos: number;
    if (op.origin === null) pos = 0;
    else {
      const originItem = this.byId.get(idToString(op.origin));
      if (originItem === undefined)
        throw new Error(`origin ${idToString(op.origin)} not present`);
      pos = this.items.indexOf(originItem) + 1;
    }
    while (pos < this.items.length && winSlotOver(this.items[pos].id, op.id)) {
      pos++;
    }

    const item: Item = {
      id: op.id,
      origin: op.origin,
      content: op.content,
      deleted: false,
    };
    this.items.splice(pos, 0, item);
    this.byId.set(key, item);
  }
  private visibleItemAt(n: number): Item {
    let seen = 0;
    for (const item of this.items) {
      if (item.deleted) continue;
      if (seen === n) return item;
      seen++;
    }
    throw new RangeError(`no visible item at ${n}`);
  }
}
