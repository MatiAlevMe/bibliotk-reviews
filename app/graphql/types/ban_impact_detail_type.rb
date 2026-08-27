module Types
  class BanImpactDetailType < Types::BaseObject
    field :book_id, Integer, null: false
    field :title, String, null: false
    field :current_average, Float, null: false
    field :projected_average, Float, null: false
    field :delta, Float, null: false
  end
end
