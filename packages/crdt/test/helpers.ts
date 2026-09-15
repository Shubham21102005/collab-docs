import type { Doc, Op } from "@collab/crdt";

/** Type `text` one character at a time starting at `index`. Returns the ops. */
export function typeText(doc: Doc, index: number, text: string): Op[] {
  const ops: Op[] = [];
  for (let i = 0; i < text.length; i++) {
    ops.push(doc.insertAt(index + i, text[i]));
  }
  return ops;
}

/** Deliver a batch of ops to a replica. */
export function deliver(ops: Op[], to: Doc): void {
  for (const op of ops) to.integrate(op);
}
