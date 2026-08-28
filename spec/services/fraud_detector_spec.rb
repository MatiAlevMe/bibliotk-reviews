require "rails_helper"

RSpec.describe FraudDetector do
  let(:book) { create(:book) }

  describe "#detect" do
    context "with few reviews" do
      before do
        create(:review, book: book, rating: 5)
        create(:review, book: book, rating: 5)
      end

      it "returns not suspicious when less than 5 reviews" do
        result = described_class.new(book).detect
        expect(result[:suspicious]).to be false
      end
    end

    context "with suspicious pattern" do
      before do
        # Create 10 reviews, all 5 stars, from recent accounts
        10.times do
          user = create(:user, created_at: 1.hour.ago)
          create(:review, book: book, rating: 5, user: user)
        end
      end

      it "detects suspicious pattern" do
        result = described_class.new(book).detect
        expect(result[:suspicious]).to be true
        expect(result[:reason]).to be_present
        expect(result[:five_star_ratio]).to be >= 0.8
      end
    end

    context "with legitimate pattern" do
      before do
        # Create 10 reviews, mixed ratings, from old accounts
        ratings = [ 1, 2, 3, 3, 4, 4, 4, 5, 5, 5 ]
        ratings.each do |rating|
          user = create(:user, created_at: 30.days.ago)
          create(:review, book: book, rating: rating, user: user)
        end
      end

      it "returns not suspicious" do
        result = described_class.new(book).detect
        expect(result[:suspicious]).to be false
      end
    end
  end

  describe ".detect_author_anomaly" do
    let(:author) { "Suspicious Author" }

    context "when author has multiple suspicious books" do
      before do
        2.times do |i|
          book = create(:book, author_name: author)
          5.times do
            user = create(:user, created_at: 1.hour.ago)
            create(:review, book: book, rating: 5, user: user)
          end
        end
      end

      it "detects author anomaly" do
        result = described_class.detect_author_anomaly(author)
        expect(result[:suspicious]).to be true
        expect(result[:flagged_books]).not_to be_empty
      end
    end
  end
end
