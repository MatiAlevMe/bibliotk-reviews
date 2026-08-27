FactoryBot.define do
  factory :book do
    sequence(:title) { |n| "Book #{n}" }
    author_name { "Author Name" }
    cached_average { 0.0 }
    cached_reviews_count { 0 }
    cached_non_banned_count { 0 }
  end
end
