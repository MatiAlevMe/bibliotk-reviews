class User < ApplicationRecord
  has_many :reviews, dependent: :destroy
  has_many :reviewed_books, through: :reviews, source: :book
  has_many :ban_audit_logs
  has_many :moderation_notifications

  validates :name, presence: true
  validates :email, presence: true, uniqueness: true

  scope :active, -> { where(banned: false) }
  scope :banned_users, -> { where(banned: true) }

  def ban!(reason:, performed_by: "system")
    return if banned?

    transaction do
      update!(banned: true, banned_at: Time.current, ban_reason: reason)

      affected_books = []
      reviews.includes(:book).find_each do |review|
        book = review.book
        book.lock!
        old_average = book.cached_average

        review.update!(hidden: true)
        book.recalculate!

        affected_books << {
          book_id: book.id,
          title: book.title,
          previous_average: old_average.to_f,
          new_average: book.cached_average.to_f
        }

        author = User.find_by(name: book.author_name)
        if author
          ModerationNotification.create!(
            user: author,
            book: book,
            previous_average: old_average,
            new_average: book.cached_average,
            reason: "Tu libro «#{book.title}» tuvo un cambio en su calificación de #{old_average} a #{book.cached_average}. Esto se debió a la exclusión de reseñas por moderación de cuenta. Si tenés preguntas, contactá a soporte@bibliotk.com"
          )
        end

        # Avisar al usuario baneado que su reseña en este libro quedó oculta.
        ModerationNotification.create!(
          user: self,
          book: book,
          previous_average: old_average,
          new_average: book.cached_average,
          reason: "Tu reseña en «#{book.title}» quedó oculta por moderación de cuenta (motivo: #{reason}). Ya no cuenta para el promedio del libro; seguís viéndola en tu perfil."
        )
      end

      BanAuditLog.create!(
        user: self,
        action: :banned,
        books_affected: affected_books.size,
        impact_details: { books: affected_books },
        performed_by: performed_by
      )
    end
  end

  def unban!(performed_by: "system")
    return unless banned?

    transaction do
      update!(banned: false, banned_at: nil, ban_reason: nil)

      affected_books = []
      reviews.includes(:book).find_each do |review|
        book = review.book
        book.lock!
        old_average = book.cached_average

        review.update!(hidden: false)
        book.recalculate!

        affected_books << {
          book_id: book.id,
          title: book.title,
          previous_average: old_average.to_f,
          new_average: book.cached_average.to_f
        }
      end

      BanAuditLog.create!(
        user: self,
        action: :unbanned,
        books_affected: affected_books.size,
        impact_details: { books: affected_books },
        performed_by: performed_by
      )
    end
  end
end
