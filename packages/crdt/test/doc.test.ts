import { describe, it, expect } from "vitest";
import { Doc } from "@collab/crdt";
import { typeText, deliver } from "./helpers.js";

describe("Doc — one replica", () => {
  it("starts empty", () => {
    expect(new Doc("A").toString()).toBe("");
  });

  it("appends", () => {
    const a = new Doc("A");
    typeText(a, 0, "hello");
    expect(a.toString()).toBe("hello");
  });

  it("inserts in the middle and at the start", () => {
    const a = new Doc("A");
    typeText(a, 0, "hlo");
    a.insertAt(1, "e"); // h|lo  →  he|lo
    expect(a.toString()).toBe("helo");
    a.insertAt(3, "l"); // hel|o
    expect(a.toString()).toBe("hello");
    a.insertAt(0, ">");
    expect(a.toString()).toBe(">hello");
  });
});

describe("Doc — two replicas", () => {
  it("converges under sequential edits from both sides", () => {
    const a = new Doc("A");
    const b = new Doc("B");

    deliver(typeText(a, 0, "ab"), b); // A types "ab", B receives it
    expect(b.toString()).toBe("ab");

    deliver(typeText(b, 1, "x"), a); // B inserts between a and b, A receives it
    expect(b.toString()).toBe("axb"); // ← these two lines are why the clock
    expect(a.toString()).toBe("axb"); //   has to be a Lamport clock
  });

  it("converges when both insert at the same spot at the same time", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    deliver(typeText(a, 0, "ab"), b);

    // Concurrent: neither has seen the other's insert yet.
    const fromA = typeText(a, 1, "1");
    const fromB = typeText(b, 1, "2");

    deliver(fromB, a);
    deliver(fromA, b);

    expect(a.toString()).toBe(b.toString());
    // Both had clock 2 after "ab", so both new items carry clock 3.
    // Tie-break: higher client id wins the slot, so B's "2" goes first.
    expect(a.toString()).toBe("a21b");
  });

  it("lands in the same place regardless of delivery order", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    const c = new Doc("C");
    const seed = typeText(a, 0, "ab");
    deliver(seed, b);
    deliver(seed, c);

    const fromA = typeText(a, 1, "1");
    const fromB = typeText(b, 1, "2");

    deliver(fromA, c); // C sees A's op first...
    deliver(fromB, c);
    deliver(fromB, a);
    deliver(fromA, b);

    expect(a.toString()).toBe("a21b");
    expect(b.toString()).toBe("a21b");
    expect(c.toString()).toBe("a21b"); // ...and still ends up identical
  });

  it("ignores an op it has already applied", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    const ops = typeText(a, 0, "hi");
    deliver(ops, b);
    deliver(ops, b); // a network retry
    expect(b.toString()).toBe("hi");
  });

  it("refuses an op whose origin it has not seen", () => {
    const a = new Doc("A");
    const b = new Doc("B");
    const [first, second] = typeText(a, 0, "hi");
    expect(() => b.integrate(second)).toThrow(/present/);
    b.integrate(first);
    b.integrate(second);
    expect(b.toString()).toBe("hi");
  });
});
