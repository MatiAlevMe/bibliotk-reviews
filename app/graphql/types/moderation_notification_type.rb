module Types
  class ModerationNotificationType < Types::BaseObject
    field :id, ID, null: false
    field :previous_average, Float, null: false
    field :new_average, Float, null: false
    field :reason, String, null: false
    field :read_at, GraphQL::Types::ISO8601DateTime, null: true
    field :created_at, GraphQL::Types::ISO8601DateTime, null: false
    field :book, Types::BookType, null: false

    def book
      object.book
    end
  end
end
