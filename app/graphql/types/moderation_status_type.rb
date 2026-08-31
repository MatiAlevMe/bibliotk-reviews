module Types
  class ModerationStatusType < Types::BaseObject
    field :book_id, ID, null: false
    field :title, String, null: false
    field :hidden_count, Integer, null: false
    field :hidden_reviews, [ Types::HiddenReviewType ], null: false
  end
end
