import { describe, it, expect } from "vitest";
import { idToString, idEquals, type ID } from "@collab/crdt";

describe("ID", () => {
  it("serialises to a stable key", () => {
    const id: ID = { client: "A", clock: 7 };
    expect(idToString(id)).toBe("A:7");
  });

  it("compares structurally, not by reference", () => {
    expect(idEquals({ client: "A", clock: 1 }, { client: "A", clock: 1 })).toBe(
      true,
    );
    expect(idEquals({ client: "A", clock: 1 }, { client: "B", clock: 1 })).toBe(
      false,
    );
    expect(idEquals(null, null)).toBe(true);
    expect(idEquals(null, { client: "A", clock: 1 })).toBe(false);
  });
});
