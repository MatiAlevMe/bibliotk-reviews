FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "User #{n}" }
    sequence(:email) { |n| "user#{n}@example.com" }
    banned { false }

    trait :banned do
      banned { true }
      banned_at { Time.current }
      ban_reason { "Spam reviews" }
    end
  end
end
