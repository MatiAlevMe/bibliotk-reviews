FactoryBot.define do
  factory :moderation_notification do
    user
    book
    previous_average { 4.0 }
    new_average { 2.0 }
    reason { "Reseñas excluidas por moderación" }
  end
end
