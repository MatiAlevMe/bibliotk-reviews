FactoryBot.define do
  factory :review do
    user
    book
    rating { rand(1..5) }
    body { nil }
    hidden { false }

    trait :hidden do
      hidden { true }
    end

    trait :with_body do
      body { Faker::Lorem.sentence(word_count: 10) }
    end
  end
end
