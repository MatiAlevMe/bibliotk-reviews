module Types
  class BanAuditLogType < Types::BaseObject
    field :id, ID, null: false
    field :action, String, null: false
    field :books_affected, Integer, null: false
    field :impact_details, GraphQL::Types::JSON, null: false
    field :performed_by, String, null: true
    field :created_at, GraphQL::Types::ISO8601DateTime, null: false
    field :user, Types::UserType, null: false

    def user
      object.user
    end
  end
end
