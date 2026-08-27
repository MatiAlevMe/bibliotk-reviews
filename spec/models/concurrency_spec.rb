require "rails_helper"

RSpec.describe "Concurrency", type: :model do
  describe "concurrent reviews on the same book" do
    let(:book) { create(:book) }
    let(:num_threads) { 200 }

    it "maintains correct average with concurrent reviews" do
      users = create_list(:user, num_threads)

      threads = users.map.with_index do |user, i|
        Thread.new do
          Review.create!(
            user: user,
            book: book,
            rating: (i % 5) + 1
          )
        end
      end

      threads.each(&:join)

      book.reload

      # Verify the book has the correct count
      expect(book.cached_reviews_count).to eq(num_threads)

      # Verify average is mathematically correct
      expected_sum = (1..num_threads).sum { |i| (i % 5) + 1 }
      expected_avg = (expected_sum.to_f / num_threads).round(1)
      expect(book.cached_average).to eq(expected_avg)
    end

    it "prevents duplicate reviews from same user" do
      user = create(:user)

      threads = 10.times.map do
        Thread.new do
          Review.create(
            user: user,
            book: book,
            rating: 4
          )
        end
      end

      threads.each(&:join)

      expect(user.reviews.where(book: book).count).to eq(1)
    end
  end
end
