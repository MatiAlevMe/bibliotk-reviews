module Types
  class ReviewType < Types::BaseObject
    field :id, ID, null: false
    field :rating, Integer, null: false
    field :body, String, null: true
    field :hidden, Boolean, null: false
    field :created_at, GraphQL::Types::ISO8601DateTime, null: false
    field :updated_at, GraphQL::Types::ISO8601DateTime, null: false
    field :user, Types::UserType, null: false
    field :book, Types::BookType, null: false

    def user
      object.user
    end

    def book
      object.book
    end
  end
end
