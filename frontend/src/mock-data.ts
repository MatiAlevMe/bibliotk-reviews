/**
 * mock-data.ts — Datos de fábrica para el modo offline (sin backend).
 *
 * Replica el seed de Rails (db/seeds.rb): admin, 5 autores, 50 lectores
 * (Reader 1..50, ids 7-56) y los 10 títulos reales con reseñas determinísticas.
 * El cluster de 5★ "recientes" en «El Aleph» existe a propósito para que la
 * detección de fraude de la demo tenga un caso positivo que mostrar.
 *
 * Esta estructura es la "fábrica" inmutable; mock-client.ts la clona al
 * inicio y al hacer reset, de modo que los cambios de sesión no la mutan.
 */

import type {
  Book,
  User,
  Review,
  BanAuditLog,
  ModerationNotification,
} from "./types";

export interface MockReview extends Review {
  id: string;
  userId: string;
  bookId: string;
  createdAt: string;
}

export interface MockUser extends User {
  bannedAt: string | null;
  banReason: string | null;
}

export interface MockBook extends Book {
  /** all reviews (hidden and visible) */
  reviews: MockReview[];
}

export interface MockBanLog extends BanAuditLog {
  userId: string;
}

export interface MockNotification extends ModerationNotification {
  userId: string;
  bookId: string;
}

// ─── Users ───────────────────────────────────────────────────────────────────

const ADMIN: MockUser = {
  id: "1", name: "Admin", email: "admin@bibliotk.com",
  banned: false, bannedAt: null, banReason: null,
};

const AUTHORS: MockUser[] = [
  { id: "2",  name: "Gabriel García Márquez", email: "garcia@books.com",     banned: false, bannedAt: null, banReason: null },
  { id: "3",  name: "Julio Cortázar",         email: "cortazar@books.com",   banned: false, bannedAt: null, banReason: null },
  { id: "4",  name: "Jorge Luis Borges",      email: "borges@books.com",     banned: false, bannedAt: null, banReason: null },
  { id: "5",  name: "Isabel Allende",         email: "allende@books.com",    banned: false, bannedAt: null, banReason: null },
  { id: "6",  name: "Mario Vargas Llosa",     email: "vargas@books.com",     banned: false, bannedAt: null, banReason: null },
];

// 50 lectores (ids 7-56), igual que el seed de Rails (Reader 1..50).
const READERS: MockUser[] = Array.from({ length: 50 }, (_, i) => ({
  id: String(i + 7),
  name: `Reader ${i + 1}`,
  email: `reader${i + 1}@test.com`,
  banned: false,
  bannedAt: null,
  banReason: null,
}));

export const SEED_USERS: MockUser[] = [ADMIN, ...AUTHORS, ...READERS];

// ─── Reviews helpers ──────────────────────────────────────────────────────────

function rev(
  id: string,
  userId: string,
  bookId: string,
  rating: number,
  body: string | null,
  hidden = false
): MockReview {
  return {
    id,
    userId,
    bookId,
    rating,
    body,
    hidden,
    user: { name: SEED_USERS.find((u) => u.id === userId)?.name ?? "?" },
    book: { title: "" }, // filled below
    createdAt: "2025-01-01T00:00:00Z",
  };
}

// ─── Books ────────────────────────────────────────────────────────────────────

const BOOK_REVIEWS: Record<string, MockReview[]> = {
  "1": [
    rev("1",  "7",  "1", 5, "Impresionante, una obra maestra."),
    rev("2",  "8",  "1", 5, "El realismo mágico en su máxima expresión."),
    rev("3",  "9",  "1", 4, "Muy buena pero densa en algunos pasajes."),
    rev("4",  "10", "1", 5, "Una de las mejores novelas del siglo XX."),
    rev("5",  "11", "1", 4, "Gran narrativa, personajes memorables."),
    rev("6",  "12", "1", 5, "Sublime. La releería mil veces."),
  ],
  "2": [
    rev("7",  "7",  "2", 5, "Un clásico absoluto."),
    rev("8",  "8",  "2", 4, "La historia de amor más triste que leí."),
    rev("9",  "9",  "2", 5, "García Márquez en su esplendor."),
    rev("10", "10", "2", 4, "Emocionante de principio a fin."),
    rev("11", "11", "2", 3, "Buena, aunque esperaba más."),
  ],
  "3": [
    rev("12", "7",  "3", 5, "Rayuela es una experiencia, no un libro."),
    rev("13", "8",  "3", 5, "Rompió todos mis esquemas narrativos."),
    rev("14", "9",  "3", 4, "Cortázar juega con el lector de forma magistral."),
    rev("15", "10", "3", 5, "Revolucionaria para su época."),
    rev("16", "11", "3", 4, "Exige mucho del lector, pero vale cada página."),
    rev("17", "12", "3", 5, "La mejor novela experimental en español."),
  ],
  "4": [
    rev("18", "7",  "4", 4, "Borges destila filosofía en cada cuento."),
    rev("19", "8",  "4", 5, "Perfecta. Cada relato es un universo."),
    rev("20", "9",  "4", 5, "El laberinto de Borges atrapa la mente."),
    rev("21", "13", "4", 4, "Fascinante, aunque compleja para iniciados."),
    rev("22", "14", "4", 5, "La cumbre de la literatura fantástica."),
  ],
  "5": [
    rev("23", "7",  "5", 4, "Una historia poderosa sobre la memoria."),
    rev("24", "8",  "5", 4, "Allende sabe narrar el drama familiar."),
    rev("25", "9",  "5", 5, "Épica y emotiva. Imprescindible."),
    rev("26", "15", "5", 3, "Interesante pero algo lenta al inicio."),
    rev("27", "16", "5", 4, "Un fresco de la historia latinoamericana."),
  ],
  "6": [
    rev("28", "7",  "6", 3, "Vargas Llosa ambicioso como siempre."),
    rev("29", "8",  "6", 4, "Retrata perfectamente la dictadura peruana."),
    rev("30", "9",  "6", 4, "Densamente política pero fascinante."),
    rev("31", "10", "6", 5, "Una de sus mejores obras."),
    rev("32", "11", "6", 3, "Interesante pero no su mejor trabajo."),
  ],
  "7": [
    rev("33", "7",  "7", 4, "Cortázar convierte lo cotidiano en pesadilla."),
    rev("34", "8",  "7", 5, "Bestiario es un manual del asombro."),
    rev("35", "9",  "7", 4, "“La casa tomada” vale el libro entero."),
    rev("36", "10", "7", 5, "Una colección que no envejece."),
  ],
  "8": [
    rev("37", "7",  "8", 5, "Borges en su punto más alto."),
    rev("38", "8",  "8", 5, "El Aleph es infinito, como todo Borges."),
    rev("39", "9",  "8", 5, "Cuentos perfectos, sin una palabra de más."),
    rev("40", "10", "8", 4, "Algunos relatos exigen relectura."),
    rev("41", "11", "8", 5, "“La biblioteca de Babel” es imprescindible."),
    rev("42", "12", "8", 5, "Una mente brillante en cada página."),
    // Cluster sospechoso: cuentas recientes (id > 14) con 5★ masivas →
    // dispara la detección de fraude en la demo (fiveStarRatio + recentAccountsRatio altos).
    rev("52", "17", "8", 5, "Excelente."),
    rev("53", "18", "8", 5, "Muy recomendable."),
    rev("54", "19", "8", 5, "Una obra cumbre."),
    rev("55", "20", "8", 5, "Genial."),
    rev("56", "21", "8", 5, "Sin palabras, perfecto."),
    rev("57", "22", "8", 5, "Un 10."),
    rev("58", "23", "8", 5, "Debe leerse sí o sí."),
    rev("59", "24", "8", 5, "Sublime."),
  ],
  "9": [
    rev("43", "7",  "9", 4, "Eva Luna narra con magia y resistencia."),
    rev("44", "8",  "9", 4, "Allende construye una heroína inolvidable."),
    rev("45", "9",  "9", 3, "Buena, aunque menos intensa que otras de Allende."),
    rev("46", "10", "9", 3, "Encantadora, algo lenta a mitad."),
  ],
  "10": [
    rev("47", "7",  "10", 5, "Un retrato duro y brillante del colegio militar."),
    rev("48", "8",  "10", 5, "Vargas Llosa debutó fuerte."),
    rev("49", "9",  "10", 5, "Narrativa poderosísima."),
    rev("50", "10", "10", 4, "Cruda y necesaria."),
    rev("51", "11", "10", 5, "Un clásico latinoamericano."),
  ],
};

function calcAverage(reviews: MockReview[]): number {
  const visible = reviews.filter((r) => !r.hidden);
  if (visible.length === 0) return 0;
  const sum = visible.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / visible.length) * 10) / 10;
}

function calcConfidence(count: number): "low" | "medium" | "high" {
  if (count < 3) return "low";
  if (count < 10) return "medium";
  return "high";
}

function makeBook(
  id: string,
  title: string,
  authorName: string
): MockBook {
  const reviews = BOOK_REVIEWS[id] ?? [];
  // back-fill book title on each review
  reviews.forEach((r) => { r.book = { title }; });
  const visible = reviews.filter((r) => !r.hidden);
  const avg = calcAverage(reviews);
  const conf = calcConfidence(visible.length);
  return {
    id,
    title,
    authorName,
    cachedAverage: avg,
    displayAverage: visible.length >= 3 ? avg : "Insuficiente",
    confidence: conf,
    cachedReviewsCount: reviews.length,
    cachedNonBannedCount: visible.length,
    reviews,
  };
}

export const SEED_BOOKS: MockBook[] = [
  makeBook("1",  "Cien años de soledad",       "Gabriel García Márquez"),
  makeBook("2",  "El amor en los tiempos del cólera", "Gabriel García Márquez"),
  makeBook("3",  "Rayuela",                    "Julio Cortázar"),
  makeBook("4",  "Ficciones",                  "Jorge Luis Borges"),
  makeBook("5",  "La casa de los espíritus",   "Isabel Allende"),
  makeBook("6",  "Conversación en La Catedral","Mario Vargas Llosa"),
  makeBook("7",  "Bestiario",                "Julio Cortázar"),
  makeBook("8",  "El Aleph",                 "Jorge Luis Borges"),
  makeBook("9",  "Eva Luna",                 "Isabel Allende"),
  makeBook("10", "La ciudad y los perros",   "Mario Vargas Llosa"),
];

// ─── Ban audit logs ───────────────────────────────────────────────────────────

export const SEED_BAN_LOGS: MockBanLog[] = [];

// ─── Moderation notifications ─────────────────────────────────────────────────

export const SEED_NOTIFICATIONS: MockNotification[] = [];
