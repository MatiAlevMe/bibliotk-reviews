module Types
  class MutationType < Types::BaseObject
    # Create a review
    field :create_review, Types::ReviewType, null: true do
      argument :book_id, ID, required: true
      argument :user_id, ID, required: true
      argument :rating, Integer, required: true
      argument :body, String, required: false
    end

    def create_review(book_id:, user_id:, rating:, body: nil)
      book = Book.find_by(id: book_id)
      user = User.find_by(id: user_id)
      return nil unless book && user

      Review.create(
        book: book,
        user: user,
        rating: rating,
        body: body
      )
    end

    # Update a review
    field :update_review, Types::ReviewType, null: true do
      argument :id, ID, required: true
      argument :rating, Integer, required: false
      argument :body, String, required: false
    end

    def update_review(id:, rating: nil, body: nil)
      review = Review.find_by(id: id)
      return nil unless review

      attrs = {}
      attrs[:rating] = rating if rating
      attrs[:body] = body if body

      review.update(attrs)
      review
    end

    # Delete a review
    field :delete_review, Boolean, null: false do
      argument :id, ID, required: true
    end

    def delete_review(id:)
      review = Review.find_by(id: id)
      return false unless review

      review.destroy
      true
    end

    # Ban a user
    field :ban_user, Types::BanAuditLogType, null: true do
      argument :user_id, ID, required: true
      argument :reason, String, required: true
      argument :performed_by, String, required: false, default_value: "admin"
    end

    def ban_user(user_id:, reason:, performed_by: "admin")
      user = User.find_by(id: user_id)
      return nil unless user

      user.ban!(reason: reason, performed_by: performed_by)
      user.ban_audit_logs.last
    end

    # Unban a user
    field :unban_user, Types::BanAuditLogType, null: true do
      argument :user_id, ID, required: true
      argument :performed_by, String, required: false, default_value: "admin"
    end

    def unban_user(user_id:, performed_by: "admin")
      user = User.find_by(id: user_id)
      return nil unless user

      user.unban!(performed_by: performed_by)
      user.ban_audit_logs.last
    end
  end
end
