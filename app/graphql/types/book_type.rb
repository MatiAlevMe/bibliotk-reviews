module Types
  class BookType < Types::BaseObject
    field :id, ID, null: false
    field :title, String, null: false
    field :author_name, String, null: false
    field :cached_average, Float, null: false
    field :cached_reviews_count, Integer, null: false
    field :cached_non_banned_count, Integer, null: false
    field :display_average, String, null: false
    field :confidence, String, null: false
    field :reviews, [Types::ReviewType], null: false
    field :visible_reviews, [Types::ReviewType], null: false

    def reviews
      object.reviews
    end

    def visible_reviews
      object.reviews.visible
    end
  end
end
