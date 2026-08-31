import { describe, it, expect, beforeEach, vi } from "vitest";
import { fmtAverage } from "../src/ui";
import { state, ROLE_ACCOUNTS } from "../src/state";
import { mockApi, resetMockData } from "../src/mock-client";

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

describe("mockApi", () => {
  beforeEach(() => {
    resetMockData();
  });

  it("returns top books", async () => {
    const { topBooks } = await mockApi.topBooks(5);
    expect(topBooks.length).toBe(5);
    expect(topBooks[0].title).toBeDefined();
    expect(typeof topBooks[0].cachedAverage).toBe("number");
  });

  it("creates a review and updates book aggregates", async () => {
    const res = await mockApi.createReview({
      bookId: "7",
      userId: "15",
      rating: 5,
      body: "Excelente lectura",
    });
    expect(res.createReview).not.toBeNull();
    expect(res.createReview?.rating).toBe(5);

    const { book } = await mockApi.book("7");
    expect(book?.cachedReviewsCount).toBeGreaterThan(4);
  });

  it("bans a user and recalculates affected books", async () => {
    const banRes = await mockApi.banUser({
      userId: "7",
      reason: "Spam",
    });
    expect(banRes.banUser?.action).toBe("banned");
    expect(banRes.banUser?.booksAffected).toBeGreaterThan(0);

    const userRes = await mockApi.user("7");
    expect(userRes.user?.banned).toBe(true);
  });

  it("notifies the author of affected books when banning (like User#ban!)", async () => {
    // Reader 1 (id 7) reviews books 1..8 — all authored by real users in mock-data.
    await mockApi.banUser({ userId: "7", reason: "Reseñas falsas" });

    // Card 1 (id 1) belongs to author id 2 (García Márquez).
    const { notifications } = await mockApi.notifications("2");
    const card = notifications.find((n) => n.book?.title === "Cien años de soledad");
    expect(card).toBeDefined();
    expect(card?.reason).toContain("moderación de cuenta");

    // The banned reader is NOT the notification recipient.
    const { notifications: bannedUserNotifs } = await mockApi.notifications("7");
    expect(bannedUserNotifs).toHaveLength(0);
  });

  it("exposes seed books aligned with the real Rails seed", async () => {
    const { topBooks } = await mockApi.topBooks(200);
    const titles = topBooks.map((b) => b.title);
    expect(titles).toContain("Bestiario");
    expect(titles).toContain("El Aleph");
    expect(titles).toContain("Eva Luna");
    expect(titles).toContain("La ciudad y los perros");
    expect(titles).not.toContain("El proceso");
  });

  it("flags the fraud cluster on El Aleph as suspicious", async () => {
    const { fraudAuthorAnomaly } = await mockApi.fraudAuthorAnomaly("Jorge Luis Borges");
    expect(fraudAuthorAnomaly?.suspicious).toBe(true);
    expect(fraudAuthorAnomaly?.flaggedBooks?.length).toBeGreaterThan(0);
  });
});

