module Types
  class FraudAuthorAnomalyType < Types::BaseObject
    field :suspicious, Boolean, null: false
    field :author, String, null: true
    field :flagged_books, GraphQL::Types::JSON, null: true
    field :checked_at, GraphQL::Types::ISO8601DateTime, null: true
  end
end
