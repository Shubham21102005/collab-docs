import { describe, it, expect } from "vitest";
import { Doc, idToString, type Op } from "@collab/crdt";

/**
 * Tiny deterministic PRNG (mulberry32). Same seed → same sequence, so a
 * failing run can be replayed exactly. Never use Math.random() in a fuzzer.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ALPHABET = "abcdefghij";

function runScenario(seed: number, replicas = 3, steps = 200): void {
  const rand = rng(seed);
  const int = (n: number) => Math.floor(rand() * n);

  const docs = Array.from(
    { length: replicas },
    (_, i) => new Doc(String.fromCharCode(65 + i)),
  );
  const inboxes: Op[][] = docs.map(() => []);

  // The oracle: what the final document must contain, independent of any replica.
  let inserts = 0;
  const deleted = new Set<string>();

  const broadcast = (from: number, op: Op): void => {
    inboxes.forEach((inbox, i) => {
      if (i !== from) inbox.push(op);
    });
  };

  for (let step = 0; step < steps; step++) {
    const i = int(replicas);
    const doc = docs[i];
    const inbox = inboxes[i];
    const roll = rand();

    if (roll < 0.4) {
      // Local insert at a random visible position.
      const op = doc.insertAt(
        int(doc.length + 1),
        ALPHABET[int(ALPHABET.length)],
      );
      inserts++;
      broadcast(i, op);
    } else if (roll < 0.55 && doc.length > 0) {
      // Local delete of a random visible character.
      const op = doc.deleteAt(int(doc.length));
      deleted.add(idToString(op.id));
      broadcast(i, op);
    } else if (inbox.length > 0) {
      // Deliver ONE op, chosen from anywhere in the inbox — not the front.
      // This is the reordering a real network does.
      const k = int(inbox.length);
      const op = inbox[k];
      // 10% of the time leave it in the inbox, so it arrives again later.
      if (rand() > 0.1) inbox.splice(k, 1);
      doc.integrate(op);
    }
  }

  // Drain: deliver everything still in flight.
  inboxes.forEach((inbox, i) => {
    for (const op of inbox) docs[i].integrate(op);
    inbox.length = 0;
  });

  const texts = docs.map((d) => d.toString());
  const why = `seed ${seed}\n${docs.map((d, i) => `${d.client}: "${texts[i]}"`).join("\n")}`;

  for (const d of docs) {
    expect(d.toString(), `${why}\nreplicas diverged`).toBe(texts[0]);
    expect(d.length, `${why}\n${d.client} has wrong visible length`).toBe(
      inserts - deleted.size,
    );
    expect(d.size, `${why}\n${d.client} is missing items`).toBe(inserts);
    expect(d.pendingCount, `${why}\n${d.client} has ops stuck in pending`).toBe(
      0,
    );
  }
}

describe("fuzz — random ops, random delivery order, duplicate delivery", () => {
  it("converges across 300 seeds", () => {
    for (let seed = 1; seed <= 300; seed++) runScenario(seed);
  });
});
