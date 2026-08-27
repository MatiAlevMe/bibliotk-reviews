module Types
  class FraudCheckType < Types::BaseObject
    field :suspicious, Boolean, null: false
    field :reason, String, null: true
    field :five_star_ratio, Float, null: true
    field :recent_accounts_ratio, Float, null: true
    field :total_reviews, Integer, null: true
  end
end
