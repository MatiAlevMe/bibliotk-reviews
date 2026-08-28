class BanImpactAnalyzer
  attr_reader :user

  def initialize(user)
    @user = user
  end
  def analyze
    reviews = user.reviews.includes(:book)

    books_affected = reviews.map do |review|
      book = review.book
      current_avg = book.cached_average.to_f
      current_count = book.reviews_count_raw.positive? ? book.reviews_count_raw : book.cached_non_banned_count
      current_sum = book.reviews_sum.positive? ? book.reviews_sum : (current_avg * current_count).round

      new_count = current_count - 1
      if new_count <= 0
        projected_avg = 0.0
      else
        total_without = current_sum - review.rating
        projected_avg = (total_without.to_f / new_count).round(1)
      end

      {
        book_id: book.id,
        title: book.title,
        current_average: current_avg,
        projected_average: projected_avg,
        delta: (projected_avg - current_avg).round(1)
      }
    end

    {
      user_id: user.id,
      user_name: user.name,
      total_reviews: user.reviews.count,
      books_affected: books_affected.size,
      details: books_affected
    }
  end
end
