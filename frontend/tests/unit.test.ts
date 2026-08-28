import { describe, it, expect, beforeEach, vi } from "vitest";
import { fmtAverage } from "../src/ui";
import { state, ROLE_ACCOUNTS } from "../src/state";

describe("fmtAverage", () => {
  it("formats a number to one decimal", () => {
    expect(fmtAverage(4.5)).toBe("4.5");
    expect(fmtAverage(3)).toBe("3.0");
  });

  it("passes through the Insuficientes string", () => {
    expect(fmtAverage("Insuficientes")).toBe("Insuficientes");
  });
});

describe("state", () => {
  const store = new Map<string, string>();

  const mockStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };

  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", mockStorage);
  });

  it("returns the default actor when nothing is stored", () => {
    const actor = state.getActor();
    expect(actor.role).toBe("reader");
    expect(actor.userId).toBe("7");
  });

  it("persists and restores an actor", () => {
    state.setActor({ role: "admin", userId: "1", userName: "Admin" });
    const actor = state.getActor();
    expect(actor.role).toBe("admin");
    expect(actor.userName).toBe("Admin");
  });

  it("falls back to default when stored JSON is corrupted", () => {
    store.set("bibliotk.demo.actor", "{not-json");
    const actor = state.getActor();
    expect(actor.role).toBe("reader");
  });
});

describe("role accounts", () => {
  it("has at least one account per role", () => {
    for (const role of ["admin", "author", "reader"] as const) {
      expect(ROLE_ACCOUNTS[role].length).toBeGreaterThan(0);
    }
  });
});
