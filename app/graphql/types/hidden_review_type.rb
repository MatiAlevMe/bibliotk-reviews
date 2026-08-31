module Types
  class HiddenReviewType < Types::BaseObject
    field :id, ID, null: false
    field :user_id, ID, null: false
    field :user_name, String, null: false
    field :rating, Integer, null: false
    field :hidden_at, GraphQL::Types::ISO8601DateTime, null: false
    field :ban_reason, String, null: true
  end
end
