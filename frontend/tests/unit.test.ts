import { describe, it, expect, beforeEach, vi } from "vitest";
import { fmtAverage, riskLabel, riskClass } from "../src/ui";
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

describe("risk labels (Spanish presentation)", () => {
  it("maps confidence to risk in Spanish", () => {
    expect(riskLabel("low")).toBe("Alto");
    expect(riskLabel("medium")).toBe("Medio");
    expect(riskLabel("high")).toBe("Bajo");
    expect(riskClass("low")).toBe("high"); // poca data → badgete peligro
    expect(riskClass("high")).toBe("low");  // mucha data → badge seguro
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

  it("expands the mock catalog to 20 books (top 50 has volume)", async () => {
    const { topBooks } = await mockApi.topBooks(50);
    expect(topBooks.length).toBeGreaterThanOrEqual(20);
    const titles = topBooks.map((b) => b.title);
    expect(titles).toContain("Crónica de una muerte anunciada");
    expect(titles).toContain("Paula");
    // cada libro expone su autor para la columna del top 50
    for (const b of topBooks) expect(b.authorName).toBeTruthy();
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

    // The banned reader IS notified that their reviews were hidden.
    const { notifications: bannedUserNotifs } = await mockApi.notifications("7");
    expect(bannedUserNotifs.length).toBeGreaterThan(0);
    expect(bannedUserNotifs[0].reason).toContain("quedó oculta por moderación");
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

  it("hides a single review by moderation without banning the user", async () => {
    const { bookReviews } = await mockApi.bookReviews("7");
    const target = bookReviews[0];
    expect(target.hidden).toBe(false);

    const res = await mockApi.hideReview({ id: target.id, reason: "Contenido inapropiado" });
    expect(res.hideReview).toBe(true);

    // El usuario sigue activo.
    const ownerId = "7";
    const { user } = await mockApi.user(ownerId);
    expect(user?.banned).toBe(false);

    // La review aparece como oculta con motivo en moderationStatus.
    const { moderationStatus } = await mockApi.moderationStatus("7");
    const hidden = moderationStatus?.hiddenReviews.find((h) => h.id === target.id);
    expect(hidden).toBeDefined();
    expect(hidden?.banReason).toBe("Contenido inapropiado");
  });

  it("restores a hidden review with showReview", async () => {
    const { bookReviews } = await mockApi.bookReviews("7");
    const target = bookReviews[0];
    await mockApi.hideReview({ id: target.id, reason: "Spam" });

    const res = await mockApi.showReview(target.id);
    expect(res.showReview).toBe(true);

    const after = await mockApi.bookReviews("7");
    expect(after.bookReviews.find((r) => r.id === target.id)?.hidden).toBe(false);
  });

  it("banned users cannot create new visible reviews (they get immediately hidden)", async () => {
    await mockApi.banUser({ userId: "7", reason: "Fraude" });
    const res = await mockApi.createReview({
      bookId: "19",
      userId: "7",
      rating: 5,
      body: "nueva",
    });
    // like Rails: Review#hide_if_user_banned! → la review queda hidden: true
    expect(res.createReview?.hidden).toBe(true);

    const after = await mockApi.bookReviews("19");
    expect(after.bookReviews.find((r) => r.id === res.createReview?.id)).toBeUndefined();
  });

  it("moderationStatus reports the owner userId of each hidden review", async () => {
    const { bookReviews } = await mockApi.bookReviews("7");
    const target = bookReviews[0];
    await mockApi.hideReview({ id: target.id, reason: "Contenido inapropiado" });

    const { moderationStatus } = await mockApi.moderationStatus("7");
    const hidden = moderationStatus?.hiddenReviews.find((h) => h.id === target.id);
    expect(hidden).toBeDefined();
    expect(hidden?.userId).toBe("7"); // la primera reseña del libro 7 belongs a Reader 1 (id 7)
  });

  it("an author who gets banned is detectable as banned (ban card on home)", async () => {
    // Vestigio: even though authors don't review books in the seed, the ban
    // state must surface via api.user so the home card "Tu cuenta fue baneada"
    // renders for authors (same code path as for readers).
    await mockApi.banUser({ userId: "2", reason: "Reseñas falsas" });
    const { user } = await mockApi.user("2");
    expect(user?.banned).toBe(true);
    expect(user?.banReason).toBe("Reseñas falsas");
  });
});

