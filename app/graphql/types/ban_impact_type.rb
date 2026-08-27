module Types
  class BanImpactType < Types::BaseObject
    field :user_id, Integer, null: false
    field :user_name, String, null: false
    field :total_reviews, Integer, null: false
    field :books_affected, Integer, null: false
    field :details, [Types::BanImpactDetailType], null: false
  end
end
