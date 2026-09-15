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

export type DeleteOp = {
  type: "delete";
  id: ID;
};

export type Op = InsertOp | DeleteOp;

function winSlotOver(a: ID, b: ID): boolean {
  if (a.clock !== b.clock) return a.clock > b.clock; //newer value must win always
  return a.client > b.client;
}

export class Doc {
  readonly client: string;

  private clock = 0;
  private items: Item[] = [];
  private byId = new Map<string, Item>(); //id-> item, for origin lookup
  private pending: Op[] = [];

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

  get size(): number {
    //actual size, including tombstones
    return this.items.length;
  }

  get pendingCount(): number {
    return this.pending.length;
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
  deleteAt(index: number): DeleteOp {
    if (index < 0 || index > this.length) {
      throw new RangeError(`index ${index} out of range `);
    }
    const op: DeleteOp = { type: "delete", id: this.visibleItemAt(index).id };
    this.integrate(op);
    return op;
  }

  integrate(op: Op): void {
    if (!this.canApply(op)) {
      this.pending.push(op);
      return;
    }
    this.apply(op);
    this.drainPending();
  }

  private apply(op: Op): void {
    switch (op.type) {
      case "insert":
        this.integrateInsert(op);
        break;
      case "delete":
        this.integrateDelete(op);
        break;
      default:
        const unreachable: never = op;
        throw new Error(`Unknown Operation ${JSON.stringify(unreachable)}`);
    }
  }

  private canApply(op: Op): boolean {
    switch (op.type) {
      case "insert":
        return op.origin === null || this.byId.has(idToString(op.origin));
      case "delete":
        return this.byId.has(idToString(op.id));
    }
  }
  private drainPending(): void {
    let prog = true; // denote progress, one op can make others applicable, stop obly when pull pass applies nothing
    while (prog) {
      prog = false;
      for (let i = 0; i < this.pending.length; i++) {
        const op = this.pending[i];
        if (this.canApply(op)) {
          this.pending.splice(i, 1);
          i--; //array shifted after splice
          this.apply(op);
          prog = true;
        }
      }
    }
  }

  integrateInsert(op: InsertOp): void {
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

  integrateDelete(op: DeleteOp): void {
    const item = this.byId.get(idToString(op.id));
    if (item === undefined) {
      throw new Error(`Cannot delete, ${idToString(op.id)} not present`);
    }
    item.deleted = true;
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
