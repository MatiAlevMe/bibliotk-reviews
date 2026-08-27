class Review < ApplicationRecord
  belongs_to :user
  belongs_to :book

  validates :rating, presence: true, inclusion: { in: 1..5 }
  validates :body, length: { maximum: 1000 }, allow_blank: true
  validates :user_id, uniqueness: { scope: :book_id, message: "ya tiene una reseña para este libro" }

  scope :visible, -> { where(hidden: false) }
  scope :hidden_reviews, -> { where(hidden: true) }

  after_save :recalculate_book!, unless: :saved_change_to_hidden?
  after_destroy :recalculate_book!
  after_save :hide_if_user_banned!, if: -> { !hidden? && user.banned? }

  private

  def recalculate_book!
    Book.transaction do
      book.lock!
      book.recalculate!
    end
  end

  def hide_if_user_banned!
    update_column(:hidden, true) if user.banned?
  end
end
