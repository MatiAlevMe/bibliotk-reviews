module Types
  class UserType < Types::BaseObject
    field :id, ID, null: false
    field :name, String, null: false
    field :email, String, null: false
    field :banned, Boolean, null: false
    field :banned_at, GraphQL::Types::ISO8601DateTime, null: true
    field :ban_reason, String, null: true
    field :created_at, GraphQL::Types::ISO8601DateTime, null: false
    field :reviews, [ Types::ReviewType ], null: false

    def reviews
      object.reviews
    end
  end
end
