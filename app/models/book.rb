class Book < ApplicationRecord
  has_many :reviews, dependent: :destroy
  has_many :moderation_notifications

  validates :title, presence: true
  validates :author_name, presence: true

  def author_user
    User.find_by(name: author_name)
  end

  def recalculate!
    stats = reviews
      .joins(:user)
      .where(users: { banned: false }, reviews: { hidden: false })
      .pick(Arel.sql("ROUND(AVG(rating)::numeric, 1)"), Arel.sql("COUNT(*)::int"))

    avg, count = stats
    update_columns(
      cached_average: avg || 0.0,
      cached_reviews_count: reviews.count,
      cached_non_banned_count: count || 0
    )
  end

  def display_average
    return "Insuficientes" if cached_non_banned_count < 3
    cached_average.to_f
  end

  def confidence
    case cached_non_banned_count
    when 0..2 then "low"
    when 3..9 then "medium"
    else "high"
    end
  end
end
