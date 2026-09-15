import { describe, it, expect } from "vitest";
import { Doc } from "@collab/crdt";
import { typeText, deliver } from "./helpers.js";

describe("Doc — delete, one replica", () => {
  it("deletes in the middle, at the start, and the last char", () => {
    const a = new Doc("A");
    typeText(a, 0, "cat");
    a.deleteAt(1);
    expect(a.toString()).toBe("ct");
    a.deleteAt(0);
    expect(a.toString()).toBe("t");
    a.deleteAt(0);
    expect(a.toString()).toBe("");
  });

  it("keeps tombstones: visible length shrinks, stored size does not", () => {
    const a = new Doc("A");
    typeText(a, 0, "cat");
    a.deleteAt(0);
    a.deleteAt(0);
    a.deleteAt(0);
    expect(a.length).toBe(0);
    expect(a.size).toBe(3);
  });

  it("inserts correctly next to a tombstone", () => {
    const a = new Doc("A");
    typeText(a, 0, "cat");
    a.deleteAt(1); // "ct"
    a.insertAt(1, "x"); // c|t
    expect(a.toString()).toBe("cxt");
  });

  it("rejects an out-of-range delete", () => {
    const a = new Doc("A");
    typeText(a, 0, "cat");
    expect(() => a.deleteAt(3)).toThrow(RangeError);
  });
});

describe("Doc — delete, two replicas", () => {
  it("converges when one side deletes", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    deliver(typeText(a, 0, "cat"), b);
    deliver([a.deleteAt(1)], b);
    expect(a.toString()).toBe("ct");
    expect(b.toString()).toBe("ct");
  });

  it("a concurrent insert after a deleted char still finds its origin", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    deliver(typeText(a, 0, "cat"), b);

    const del = a.deleteAt(0); // A deletes 'c'
    const ins = b.insertAt(1, "h"); // B inserts after 'c' — concurrently

    deliver([ins], a); // would throw if 'c' had been physically removed
    deliver([del], b);

    expect(a.toString()).toBe("hat");
    expect(b.toString()).toBe("hat");
  });

  it("both delete the same char concurrently — idempotent, converges", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    deliver(typeText(a, 0, "cat"), b);
    const delA = a.deleteAt(1);
    const delB = b.deleteAt(1);
    deliver([delB], a);
    deliver([delA], b);
    expect(a.toString()).toBe("ct");
    expect(b.toString()).toBe("ct");
    expect(a.size).toBe(3);
  });

  it("refuses to delete an item it has not seen", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    typeText(a, 0, "c");
    const del = a.deleteAt(0);
    expect(() => b.integrate(del)).toThrow(/present/);
  });
});
