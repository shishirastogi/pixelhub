import { describe, expect, it } from "vitest";
import { toFileEvents, type PendingEvent } from "./watcher.js";

describe("toFileEvents", () => {
  it("passes through created/modified/deleted events", () => {
    const events: PendingEvent[] = [
      { type: "created", path: "exports/a.png", sha256: "a".repeat(64), size: 10 },
      { type: "modified", path: "exports/b.png", sha256: "b".repeat(64) },
      { type: "deleted", path: "exports/gone.png" },
    ];

    expect(toFileEvents(events)).toEqual([
      { type: "created", path: "exports/a.png", sha256: "a".repeat(64), size: 10 },
      { type: "modified", path: "exports/b.png", sha256: "b".repeat(64) },
      { type: "deleted", path: "exports/gone.png" },
    ]);
  });

  it("collapses a rename (unlink + add with same hash) into one move", () => {
    const sha = "c".repeat(64);
    const events: PendingEvent[] = [
      { type: "deleted", path: "old.png", sha256: sha },
      { type: "created", path: "new.png", sha256: sha, size: 5 },
    ];

    expect(toFileEvents(events)).toEqual([
      { type: "moved", from: "old.png", to: "new.png", sha256: sha },
    ]);
  });

  it("does not treat deletions with no known hash as moves", () => {
    const events: PendingEvent[] = [
      { type: "deleted", path: "old.png" },
      { type: "created", path: "new.png", sha256: "d".repeat(64), size: 5 },
    ];

    expect(toFileEvents(events)).toEqual([
      { type: "deleted", path: "old.png" },
      { type: "created", path: "new.png", sha256: "d".repeat(64), size: 5 },
    ]);
  });

  it("uses each created file for at most one move", () => {
    const sha = "e".repeat(64);
    const events: PendingEvent[] = [
      { type: "deleted", path: "a.png", sha256: sha },
      { type: "deleted", path: "b.png", sha256: sha },
      { type: "created", path: "c.png", sha256: sha, size: 5 },
    ];

    const result = toFileEvents(events);
    const moved = result.filter((event) => event.type === "moved");
    const deleted = result.filter((event) => event.type === "deleted");

    expect(moved).toHaveLength(1);
    expect(deleted).toHaveLength(1);
  });
});
