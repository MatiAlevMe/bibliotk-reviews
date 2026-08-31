/**
 * mock-client.ts — Implementación de todas las operaciones de api.ts sobre
 * estado en memoria, para el modo offline de la demo en Vercel.
 *
 * - Los datos se inicializan con una copia profunda de SEED_*.
 * - Las mutations (createReview, banUser, etc.) mutan el estado en memoria
 *   y recalculan los aggregates del libro afectado.
 * - `resetMockData()` vuelve el estado a los valores de fábrica.
 */

import type {
  BanAuditLog,
  BanImpact,
  BanImpactDetail,
  Book,
  FraudAuthorAnomaly,
  FraudCheck,
  ModerationNotification,
  ModerationStatus,
  Review,
  User,
} from "./types";
import {
  SEED_BOOKS,
  SEED_USERS,
  SEED_BAN_LOGS,
  SEED_NOTIFICATIONS,
  type MockBook,
  type MockUser,
  type MockReview,
  type MockBanLog,
  type MockNotification,
} from "./mock-data";

// ─── State ────────────────────────────────────────────────────────────────────

let books: MockBook[];
let users: MockUser[];
let banLogs: MockBanLog[];
let notifications: MockNotification[];
let nextReviewId: number;
let nextLogId: number;
let nextNotifId: number;

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

function initState(): void {
  books     = deepClone(SEED_BOOKS);
  users     = deepClone(SEED_USERS);
  banLogs   = deepClone(SEED_BAN_LOGS);
  notifications = deepClone(SEED_NOTIFICATIONS);
  nextReviewId = 200;
  nextLogId    = 100;
  nextNotifId  = 100;
}

initState();

/** Reinicia todo el estado mock a los datos de fábrica. */
export function resetMockData(): void {
  initState();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findBook(id: string): MockBook | undefined {
  return books.find((b) => b.id === id);
}

function findUser(id: string): MockUser | undefined {
  return users.find((u) => u.id === id);
}

function recalcBook(book: MockBook): void {
  const visible = book.reviews.filter((r) => !r.hidden);
  const count = visible.length;
  const sum = visible.reduce((s, r) => s + r.rating, 0);
  const avg = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  book.cachedAverage = avg;
  book.displayAverage = count >= 3 ? avg : "Insuficiente";
  book.cachedReviewsCount = book.reviews.length;
  book.cachedNonBannedCount = count;
  book.confidence = count < 3 ? "low" : count < 10 ? "medium" : "high";
}

function toPublicBook(b: MockBook): Book {
  return {
    id: b.id,
    title: b.title,
    authorName: b.authorName,
    cachedAverage: b.cachedAverage,
    displayAverage: b.displayAverage,
    confidence: b.confidence,
    cachedReviewsCount: b.cachedReviewsCount,
    cachedNonBannedCount: b.cachedNonBannedCount,
  };
}

function toPublicReview(r: MockReview, book?: MockBook): Review {
  return {
    id: r.id,
    rating: r.rating,
    body: r.body,
    hidden: r.hidden,
    user: r.user,
    book: book ? { title: book.title } : r.book,
  };
}

// simulated network delay (feels more real)
function delay<T>(value: T, ms = 40): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

// ─── Query implementations ────────────────────────────────────────────────────

export const mockApi = {
  topBooks(limit = 50): Promise<{ topBooks: Book[] }> {
    const sorted = [...books]
      .sort((a, b) => b.cachedAverage - a.cachedAverage)
      .slice(0, limit)
      .map(toPublicBook);
    return delay({ topBooks: sorted });
  },

  book(id: string): Promise<{ book: Book | null }> {
    const b = findBook(id);
    return delay({ book: b ? toPublicBook(b) : null });
  },

  bookReviews(bookId: string, includeHidden = false): Promise<{ bookReviews: Review[] }> {
    const b = findBook(bookId);
    if (!b) return delay({ bookReviews: [] });
    const reviews = b.reviews
      .filter((r) => includeHidden || !r.hidden)
      .map((r) => toPublicReview(r, b));
    return delay({ bookReviews: reviews });
  },

  userReviews(userId: string): Promise<{ userReviews: Review[] }> {
    const result: Review[] = [];
    for (const b of books) {
      for (const r of b.reviews) {
        if (r.userId === userId) result.push(toPublicReview(r, b));
      }
    }
    return delay({ userReviews: result });
  },

  user(id: string): Promise<{ user: User | null }> {
    const u = findUser(id);
    if (!u) return delay({ user: null });
    return delay({
      user: { id: u.id, name: u.name, email: u.email, banned: u.banned },
    });
  },

  banPreview(userId: string): Promise<{ banPreview: BanImpact | null }> {
    const user = findUser(userId);
    if (!user) return delay({ banPreview: null });

    const details: BanImpactDetail[] = [];
    for (const b of books) {
      const userReviews = b.reviews.filter(
        (r) => r.userId === userId && !r.hidden
      );
      if (userReviews.length === 0) continue;
      const currentAvg = b.cachedAverage;
      // projected: recalculate excluding this user's reviews
      const remaining = b.reviews.filter(
        (r) => r.userId !== userId && !r.hidden
      );
      const projAvg =
        remaining.length > 0
          ? Math.round(
              (remaining.reduce((s, r) => s + r.rating, 0) / remaining.length) *
                10
            ) / 10
          : 0;
      details.push({
        bookId: b.id,
        title: b.title,
        currentAverage: currentAvg,
        projectedAverage: projAvg,
        delta: Math.round((projAvg - currentAvg) * 100) / 100,
      });
    }

    return delay({
      banPreview: {
        userId,
        userName: user.name,
        totalReviews: details.length,
        booksAffected: details.length,
        details,
      },
    });
  },

  moderationStatus(bookId: string): Promise<{ moderationStatus: ModerationStatus | null }> {
    const b = findBook(bookId);
    if (!b) return delay({ moderationStatus: null });
    const hiddenReviews = b.reviews
      .filter((r) => r.hidden)
      .map((r) => ({
        id: r.id,
        userName: r.user?.name ?? "?",
        rating: r.rating,
        hiddenAt: r.createdAt,
        banReason: findUser(r.userId)?.banReason ?? null,
      }));
    return delay({
      moderationStatus: {
        bookId,
        title: b.title,
        hiddenCount: hiddenReviews.length,
        hiddenReviews,
      },
    });
  },

  notifications(userId: string): Promise<{ notifications: ModerationNotification[] }> {
    const result = notifications
      .filter((n) => n.userId === userId)
      .map((n) => ({
        id: n.id,
        previousAverage: n.previousAverage,
        newAverage: n.newAverage,
        reason: n.reason,
        readAt: n.readAt,
        book: n.book,
      }));
    return delay({ notifications: result });
  },

  fraudCheck(bookId: string): Promise<{ fraudCheck: FraudCheck | null }> {
    const b = findBook(bookId);
    if (!b) return delay({ fraudCheck: null });
    const visible = b.reviews.filter((r) => !r.hidden);
    const total = visible.length;
    if (total === 0) return delay({ fraudCheck: null });
    const fiveStars = visible.filter((r) => r.rating === 5).length;
    const fiveStarRatio = fiveStars / total;
    // mock: accounts created < 24h → readers with id > 14 as "recent"
    const recentAccounts = visible.filter((r) => Number(r.userId) > 14).length;
    const recentAccountsRatio = recentAccounts / total;
    const suspicious = fiveStarRatio > 0.8 && recentAccountsRatio > 0.3;
    return delay({
      fraudCheck: {
        suspicious,
        reason: suspicious
          ? `Alta concentración de 5★ (${(fiveStarRatio * 100).toFixed(0)}%) de cuentas recientes.`
          : null,
        fiveStarRatio,
        recentAccountsRatio,
      },
    });
  },

  fraudAuthorAnomaly(authorName: string): Promise<{ fraudAuthorAnomaly: FraudAuthorAnomaly | null }> {
    const authorBooks = books.filter(
      (b) => b.authorName.toLowerCase() === authorName.toLowerCase()
    );
    if (authorBooks.length === 0) {
      return delay({ fraudAuthorAnomaly: null });
    }
    const flaggedBooks: FraudAuthorAnomaly["flaggedBooks"] = [];
    for (const b of authorBooks) {
      const visible = b.reviews.filter((r) => !r.hidden);
      const total = visible.length;
      if (total === 0) continue;
      const fiveStars = visible.filter((r) => r.rating === 5).length;
      const fiveStarRatio = fiveStars / total;
      const recentAccounts = visible.filter((r) => Number(r.userId) > 14).length;
      const recentAccountsRatio = recentAccounts / total;
      const susp = fiveStarRatio > 0.8 && recentAccountsRatio > 0.3;
      if (susp) {
        flaggedBooks!.push({
          bookId: Number(b.id),
          title: b.title,
          suspicious: true,
          reason: `${(fiveStarRatio * 100).toFixed(0)}% de reseñas 5★ de cuentas recientes.`,
          fiveStarRatio,
          recentAccountsRatio,
          totalReviews: total,
        });
      }
    }
    return delay({
      fraudAuthorAnomaly: {
        suspicious: flaggedBooks!.length > 0,
        author: authorName,
        flaggedBooks: flaggedBooks!.length > 0 ? flaggedBooks : [],
        checkedAt: new Date().toISOString(),
      },
    });
  },

  banLogs(limit = 20): Promise<{ banLogs: BanAuditLog[] }> {
    const result = [...banLogs]
      .reverse()
      .slice(0, limit)
      .map((l) => ({
        id: l.id,
        action: l.action,
        booksAffected: l.booksAffected,
        performedBy: l.performedBy,
        createdAt: l.createdAt,
        user: l.user,
      }));
    return delay({ banLogs: result });
  },

  // ─── Mutations ──────────────────────────────────────────────────────────────

  createReview(input: {
    bookId: string;
    userId: string;
    rating: number;
    body?: string;
  }): Promise<{ createReview: Review | null }> {
    const b = findBook(input.bookId);
    const u = findUser(input.userId);
    if (!b || !u) return delay({ createReview: null });
    // enforce uniqueness (user, book)
    const existing = b.reviews.find((r) => r.userId === input.userId);
    if (existing) return delay({ createReview: null });
    const newRev: MockReview = {
      id: String(nextReviewId++),
      userId: input.userId,
      bookId: input.bookId,
      rating: input.rating,
      body: input.body ?? null,
      hidden: u.banned,
      user: { name: u.name },
      book: { title: b.title },
      createdAt: new Date().toISOString(),
    };
    b.reviews.push(newRev);
    recalcBook(b);
    return delay({ createReview: toPublicReview(newRev, b) });
  },

  updateReview(input: {
    id: string;
    rating?: number;
    body?: string;
  }): Promise<{ updateReview: Review | null }> {
    for (const b of books) {
      const r = b.reviews.find((rev) => rev.id === input.id);
      if (r) {
        if (input.rating !== undefined) r.rating = input.rating;
        if (input.body !== undefined) r.body = input.body;
        recalcBook(b);
        return delay({ updateReview: toPublicReview(r, b) });
      }
    }
    return delay({ updateReview: null });
  },

  deleteReview(id: string): Promise<{ deleteReview: boolean }> {
    for (const b of books) {
      const idx = b.reviews.findIndex((r) => r.id === id);
      if (idx !== -1) {
        b.reviews.splice(idx, 1);
        recalcBook(b);
        return delay({ deleteReview: true });
      }
    }
    return delay({ deleteReview: false });
  },

  banUser(input: {
    userId: string;
    reason: string;
  }): Promise<{ banUser: BanAuditLog | null }> {
    const user = findUser(input.userId);
    if (!user || user.banned) return delay({ banUser: null });
    user.banned = true;
    user.bannedAt = new Date().toISOString();
    user.banReason = input.reason;

    let booksAffected = 0;
    for (const b of books) {
      const affected = b.reviews.filter(
        (r) => r.userId === input.userId && !r.hidden
      );
      if (affected.length > 0) {
        const prevAvg = b.cachedAverage;
        affected.forEach((r) => { r.hidden = true; });
        recalcBook(b);
        booksAffected++;
        // Notificar al autor del libro (igual que Rails: User.find_by(name: book.author_name)).
        const author = users.find((u) => u.name === b.authorName);
        if (author) {
          const notif: MockNotification = {
            id: String(nextNotifId++),
            userId: author.id,
            bookId: b.id,
            previousAverage: prevAvg,
            newAverage: b.cachedAverage,
            reason: `Tu libro «${b.title}» tuvo un cambio en su calificación de ${prevAvg.toFixed(1)} a ${b.cachedAverage.toFixed(1)}. Esto se debió a la exclusión de reseñas por moderación de cuenta. Si tenés preguntas, contactá a soporte@bibliotk.com`,
            readAt: null,
            book: { title: b.title },
          };
          notifications.push(notif);
        }
      }
    }

    const log: MockBanLog = {
      id: String(nextLogId++),
      userId: input.userId,
      action: "banned",
      booksAffected,
      performedBy: "admin",
      createdAt: new Date().toISOString(),
      user: { name: user.name },
    };
    banLogs.push(log);

    return delay({
      banUser: {
        id: log.id,
        action: log.action,
        booksAffected: log.booksAffected,
        performedBy: log.performedBy,
        createdAt: log.createdAt,
        user: log.user,
      },
    });
  },

  unbanUser(userId: string): Promise<{ unbanUser: BanAuditLog | null }> {
    const user = findUser(userId);
    if (!user || !user.banned) return delay({ unbanUser: null });
    user.banned = false;
    user.bannedAt = null;
    user.banReason = null;

    let booksAffected = 0;
    for (const b of books) {
      const affected = b.reviews.filter(
        (r) => r.userId === userId && r.hidden
      );
      if (affected.length > 0) {
        affected.forEach((r) => { r.hidden = false; });
        recalcBook(b);
        booksAffected++;
      }
    }

    const log: MockBanLog = {
      id: String(nextLogId++),
      userId,
      action: "unbanned",
      booksAffected,
      performedBy: "admin",
      createdAt: new Date().toISOString(),
      user: { name: user.name },
    };
    banLogs.push(log);

    return delay({
      unbanUser: {
        id: log.id,
        action: log.action,
        booksAffected: log.booksAffected,
        performedBy: log.performedBy,
        createdAt: log.createdAt,
        user: log.user,
      },
    });
  },
};
