export type Confidence = "low" | "medium" | "high";

export interface Book {
  id: string;
  title: string;
  authorName: string;
  cachedAverage: number;
  displayAverage: number | string;
  confidence: Confidence;
  cachedReviewsCount: number;
  cachedNonBannedCount: number;
}

export interface Review {
  id: string;
  rating: number;
  body: string | null;
  hidden: boolean;
  user?: { name: string };
  book?: { title: string };
}

export interface User {
  id: string;
  name: string;
  email: string;
  banned: boolean;
  banReason?: string | null;
  bannedAt?: string | null;
}

export interface BanImpactDetail {
  bookId: string;
  title: string;
  currentAverage: number;
  projectedAverage: number;
  delta: number;
}

export interface BanImpact {
  userId: string;
  userName: string;
  totalReviews: number;
  booksAffected: number;
  details: BanImpactDetail[];
}

export interface ModerationStatus {
  bookId: string;
  title: string;
  hiddenCount: number;
  hiddenReviews: Array<{
    id: string;
    userId: string;
    userName: string;
    rating: number;
    hiddenAt: string;
    banReason: string | null;
  }>;
}

export interface ModerationNotification {
  id: string;
  previousAverage: number;
  newAverage: number;
  reason: string;
  readAt: string | null;
  book?: { title: string };
}

export interface FraudCheck {
  suspicious: boolean;
  reason: string | null;
  fiveStarRatio: number;
  recentAccountsRatio: number;
}

export interface FraudAuthorAnomaly {
  suspicious: boolean;
  author: string | null;
  flaggedBooks: Array<{
    bookId: number;
    title: string;
    suspicious: boolean;
    reason: string;
    fiveStarRatio: number;
    recentAccountsRatio: number;
    totalReviews: number;
  }> | null;
  checkedAt: string | null;
}

export interface BanAuditLog {
  id: string;
  action: string;
  booksAffected: number;
  performedBy: string;
  createdAt: string;
  user?: { name: string };
}

export type Role = "admin" | "author" | "reader";

export type ViewId =
  | "login"
  | "top"
  | "book"
  | "moderation"
  | "author"
  | "system";
