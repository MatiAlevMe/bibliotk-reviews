module Types
  class QueryType < Types::BaseObject
    field :node, Types::NodeType, null: true, description: "Fetches an object given its ID." do
      argument :id, ID, required: true, description: "ID of the object."
    end

    def node(id:)
      context.schema.object_from_id(id, context)
    end

    field :nodes, [ Types::NodeType, null: true ], null: true, description: "Fetches a list of objects given a list of IDs." do
      argument :ids, [ ID ], required: true, description: "IDs of the objects."
    end

    def nodes(ids:)
      ids.map { |id| context.schema.object_from_id(id, context) }
    end

    # Top N books by average rating
    field :top_books, [ Types::BookType ], null: false, description: "Top books ordered by average rating" do
      argument :limit, Integer, required: false, default_value: 50
    end

    def top_books(limit:)
      Book.order(cached_average: :desc).limit(limit)
    end

    # Book detail
    field :book, Types::BookType, null: true do
      argument :id, ID, required: true
    end

    def book(id:)
      Book.find_by(id: id)
    end

    # Reviews for a book (all, including hidden for moderation)
    field :book_reviews, [ Types::ReviewType ], null: false do
      argument :book_id, ID, required: true
      argument :include_hidden, Boolean, required: false, default_value: false
    end

    def book_reviews(book_id:, include_hidden:)
      reviews = Review.where(book_id: book_id)
      reviews = reviews.visible unless include_hidden
      reviews
    end

    # User's reviews
    field :user_reviews, [ Types::ReviewType ], null: false do
      argument :user_id, ID, required: true
    end

    def user_reviews(user_id:)
      Review.where(user_id: user_id)
    end

    # Ban preview (moderation tool - read only)
    field :ban_preview, Types::BanImpactType, null: true do
      argument :user_id, ID, required: true
    end

    def ban_preview(user_id:)
      user = User.find_by(id: user_id)
      return nil unless user

      BanImpactAnalyzer.new(user).analyze
    end

    # Moderation status for a book (author can see hidden reviews)
    field :moderation_status, GraphQL::Types::JSON, null: true do
      argument :book_id, ID, required: true
    end

    def moderation_status(book_id:)
      book = Book.find_by(id: book_id)
      return nil unless book

      hidden_reviews = book.reviews.hidden_reviews.includes(:user)

      {
        book_id: book.id,
        title: book.title,
        hidden_count: hidden_reviews.count,
        hidden_reviews: hidden_reviews.map { |r|
          {
            id: r.id,
            user_name: r.user.name,
            rating: r.rating,
            hidden_at: r.updated_at,
            ban_reason: r.moderation_reason || r.user.ban_reason
          }
        }
      }
    end

    # Notifications for a user (author notifications)
    field :notifications, [ Types::ModerationNotificationType ], null: false do
      argument :user_id, ID, required: true
      argument :unread_only, Boolean, required: false, default_value: false
    end

    def notifications(user_id:, unread_only:)
      scope = ModerationNotification.where(user_id: user_id)
      scope = scope.unread if unread_only
      scope.order(created_at: :desc)
    end

    # Fraud check for a book
    field :fraud_check, Types::FraudCheckType, null: true do
      argument :book_id, ID, required: true
    end

    def fraud_check(book_id:)
      book = Book.find_by(id: book_id)
      return nil unless book

      FraudDetector.new(book).detect
    end

    # Fraud author anomaly check
    field :fraud_author_anomaly, Types::FraudAuthorAnomalyType, null: true do
      argument :author_name, String, required: true
    end

    def fraud_author_anomaly(author_name:)
      FraudDetector.detect_author_anomaly(author_name)
    end

    # Ban audit logs
    field :ban_logs, [ Types::BanAuditLogType ], null: false do
      argument :limit, Integer, required: false, default_value: 20
    end

    def ban_logs(limit:)
      BanAuditLog.order(created_at: :desc).limit(limit)
    end

    # User
    field :user, Types::UserType, null: true do
      argument :id, ID, required: true
    end

    def user(id:)
      User.find_by(id: id)
    end
  end
end
