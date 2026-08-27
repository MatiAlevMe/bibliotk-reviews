FactoryBot.define do
  factory :ban_audit_log do
    user
    action { :banned }
    books_affected { 0 }
    impact_details { { books: [] } }
    performed_by { "admin" }
  end
end
