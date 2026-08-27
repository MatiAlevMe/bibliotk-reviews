class FraudDetector
  SUSPICIOUS_RATING_PERCENTAGE = 0.8
  RECENT_ACCOUNT_HOURS = 24
  MIN_REVIEWS_FOR_ANALYSIS = 5

  attr_reader :book

  def initialize(book)
    @book = book
  end

  def detect
    return { suspicious: false, reason: nil } if book.cached_non_banned_count < MIN_REVIEWS_FOR_ANALYSIS

    reviews = book.reviews
      .joins(:user)
      .where(users: { banned: false }, reviews: { hidden: false })

    five_star_count = reviews.where(rating: 5).count
    total_count = reviews.count

    return { suspicious: false, reason: nil } if total_count == 0

    five_star_ratio = five_star_count.to_f / total_count

    if five_star_ratio >= SUSPICIOUS_RATING_PERCENTAGE
      recent_accounts = User
        .where(id: reviews.pluck(:user_id))
        .where("created_at >= ?", RECENT_ACCOUNT_HOURS.hours.ago)
        .count

      recent_ratio = recent_accounts.to_f / total_count

      if recent_ratio >= 0.5
        return {
          suspicious: true,
          reason: "#{(five_star_ratio * 100).round}% de reseñas son 5★, " \
                  "#{(recent_ratio * 100).round}% de cuentas son recientes (<24h)",
          five_star_ratio: five_star_ratio.round(3),
          recent_accounts_ratio: recent_ratio.round(3),
          total_reviews: total_count,
          flagged_at: Time.current
        }
      end
    end

    { suspicious: false, reason: nil }
  end

  def self.detect_author_anomaly(author_name)
    books = Book.where(author_name: author_name)
    return { suspicious: false } if books.count < 2

    results = books.map do |book|
      detector = new(book)
      result = detector.detect
      next unless result[:suspicious]

      { book_id: book.id, title: book.title }.merge(result)
    end.compact

    {
      suspicious: results.any?,
      author: author_name,
      flagged_books: results,
      checked_at: Time.current
    }
  end
end
