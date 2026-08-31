import type {
  BanAuditLog,
  BanImpact,
  Book,
  FraudCheck,
  FraudAuthorAnomaly,
  ModerationNotification,
  ModerationStatus,
  Review,
  User,
} from "./types";
import { mockApi } from "./mock-client";

export interface GqlResult<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

interface ViteMetaEnv {
  VITE_GRAPHQL_ENDPOINT?: string;
  PROD?: boolean;
  DEV?: boolean;
}

const META_ENV = (import.meta as unknown as { env?: ViteMetaEnv }).env ?? {};
const RAW_ENDPOINT = META_ENV.VITE_GRAPHQL_ENDPOINT ?? "";

/**
 * MOCK_MODE — cuándo se usa el mock client en memoria en vez de GraphQL real.
 * - Forzado: `VITE_GRAPHQL_ENDPOINT=mock` en .env.local → siempre mock.
 * - Producción sin endpoint: build de Vercel (backend no desplegado) → mock/offline.
 * - Dev (`npm run dev`): NO mock — Vite proxea /graphql → localhost:3000 (backend real).
 */
export const MOCK_MODE: boolean =
  RAW_ENDPOINT === "mock" || (RAW_ENDPOINT === "" && META_ENV.PROD === true);

const GRAPHQL_ENDPOINT = MOCK_MODE ? "/graphql" : RAW_ENDPOINT;

async function gql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: variables ?? {} }),
  });
  if (!res.ok) {
    throw new Error(`GraphQL HTTP ${res.status}: ${await res.text()}`);
  }
  const body = (await res.json()) as GqlResult<T>;
  if (body.errors && body.errors.length > 0) {
    throw new Error(body.errors.map((e) => e.message).join("; "));
  }
  return body.data;
}

const BOOK_FIELDS = `
  id
  title
  authorName
  cachedAverage
  displayAverage
  confidence
  cachedReviewsCount
  cachedNonBannedCount
`;

const REVIEW_FIELDS = `
  id
  rating
  body
  hidden
  createdAt
  user { id name }
  book { id title }
`;

function realApi() {
  return {
    topBooks: (limit = 50) =>
      gql<{ topBooks: Book[] }>(`query { topBooks(limit: $limit) { ${BOOK_FIELDS} } }`, { limit }),
    book: (id: string) =>
      gql<{ book: Book | null }>(`query { book(id: $id) { ${BOOK_FIELDS} } }`, { id }),
    bookReviews: (bookId: string, includeHidden = false) =>
      gql<{ bookReviews: Review[] }>(
        `query { bookReviews(bookId: $bookId, includeHidden: $includeHidden) { ${REVIEW_FIELDS} } }`,
        { bookId, includeHidden }
      ),
    userReviews: (userId: string) =>
      gql<{ userReviews: Review[] }>(
        `query { userReviews(userId: $userId) { ${REVIEW_FIELDS} } }`,
        { userId }
      ),
    user: (id: string) =>
      gql<{ user: User | null }>(
        `query { user(id: $id) { id name email banned banReason bannedAt } }`,
        { id }
      ),
    banPreview: (userId: string) =>
      gql<{ banPreview: BanImpact | null }>(
        `query { banPreview(userId: $userId) {
          userId userName totalReviews booksAffected
          details { bookId title currentAverage projectedAverage delta }
        } }`,
        { userId }
      ),
    moderationStatus: (bookId: string) =>
      gql<{ moderationStatus: ModerationStatus | null }>(
        `query { moderationStatus(bookId: $bookId) {
          bookId title hiddenCount hiddenReviews { id userName rating hiddenAt banReason }
        } }`,
        { bookId }
      ),
    notifications: (userId: string) =>
      gql<{ notifications: ModerationNotification[] }>(
        `query { notifications(userId: $userId) {
          id previousAverage newAverage reason readAt book { title }
        } }`,
        { userId }
      ),
    fraudCheck: (bookId: string) =>
      gql<{ fraudCheck: FraudCheck | null }>(
        `query { fraudCheck(bookId: $bookId) {
          suspicious reason fiveStarRatio recentAccountsRatio totalReviews
        } }`,
        { bookId }
      ),
    fraudAuthorAnomaly: (authorName: string) =>
      gql<{ fraudAuthorAnomaly: FraudAuthorAnomaly | null }>(
        `query ($authorName: String!) {
          fraudAuthorAnomaly(authorName: $authorName) {
            suspicious
            author
            flaggedBooks
            checkedAt
          }
        }`,
        { authorName }
      ),
    banLogs: (limit = 20) =>
      gql<{ banLogs: BanAuditLog[] }>(
        `query { banLogs(limit: $limit) {
          id action booksAffected performedBy createdAt user { name }
        } }`,
        { limit }
      ),
    createReview: (input: { bookId: string; userId: string; rating: number; body?: string }) =>
      gql<{ createReview: Review | null }>(
        `mutation ($bookId: ID!, $userId: ID!, $rating: Int!, $body: String) {
          createReview(bookId: $bookId, userId: $userId, rating: $rating, body: $body) {
            ${REVIEW_FIELDS}
          }
        }`,
        input
      ),
    updateReview: (input: { id: string; rating?: number; body?: string }) =>
      gql<{ updateReview: Review | null }>(
        `mutation ($id: ID!, $rating: Int, $body: String) {
          updateReview(id: $id, rating: $rating, body: $body) { ${REVIEW_FIELDS} }
        }`,
        input
      ),
    deleteReview: (id: string) =>
      gql<{ deleteReview: boolean }>(
        `mutation ($id: ID!) { deleteReview(id: $id) }`,
        { id }
      ),
    hideReview: (input: { id: string; reason: string }) =>
      gql<{ hideReview: boolean }>(
        `mutation ($id: ID!, $reason: String!) { hideReview(id: $id, reason: $reason) }`,
        input
      ),
    showReview: (id: string) =>
      gql<{ showReview: boolean }>(
        `mutation ($id: ID!) { showReview(id: $id) }`,
        { id }
      ),
    banUser: (input: { userId: string; reason: string }) =>
      gql<{ banUser: BanAuditLog | null }>(
        `mutation ($userId: ID!, $reason: String!) {
          banUser(userId: $userId, reason: $reason) {
            id action booksAffected performedBy createdAt user { name }
          }
        }`,
        input
      ),
    unbanUser: (userId: string) =>
      gql<{ unbanUser: BanAuditLog | null }>(
        `mutation ($userId: ID!) {
          unbanUser(userId: $userId) {
            id action booksAffected performedBy createdAt user { name }
          }
        }`,
        { userId }
      ),
  };
}

/** Punto de entrada único para toda la app. En mock mode → mockApi, si no → GraphQL real. */
export const api = MOCK_MODE ? mockApi : realApi();
