require "rails_helper"

RSpec.describe Book, type: :model do
  describe "validations" do
    it { should validate_presence_of(:title) }
    it { should validate_presence_of(:author_name) }
  end

  describe "#recalculate!" do
    let(:book) { create(:book) }

    context "with reviews" do
      before do
        create(:review, book: book, rating: 3)
        create(:review, book: book, rating: 4)
        create(:review, book: book, rating: 5)
        book.recalculate!
      end

      it "calculates average correctly" do
        expect(book.cached_average).to eq(4.0)
      end

      it "counts all reviews" do
        expect(book.cached_reviews_count).to eq(3)
      end

      it "counts non-banned reviews" do
        expect(book.cached_non_banned_count).to eq(3)
      end
    end

    context "with banned users" do
      let(:banned_user) { create(:user, :banned) }

      before do
        create(:review, book: book, rating: 3)
        create(:review, book: book, rating: 4)
        create(:review, book: book, rating: 5, user: banned_user)
        book.recalculate!
      end

      it "excludes banned users from average" do
        expect(book.cached_average).to eq(3.5)
      end

      it "counts banned reviews in total" do
        expect(book.cached_reviews_count).to eq(3)
      end

      it "counts only non-banned" do
        expect(book.cached_non_banned_count).to eq(2)
      end
    end

    context "with hidden reviews" do
      before do
        create(:review, book: book, rating: 3)
        create(:review, book: book, rating: 4)
        create(:review, book: book, rating: 5, hidden: true)
        book.recalculate!
      end

      it "excludes hidden reviews from average" do
        expect(book.cached_average).to eq(3.5)
      end
    end

    context "with no reviews" do
      it "sets average to 0" do
        book.recalculate!
        expect(book.cached_average).to eq(0.0)
      end
    end
  end

  describe "#display_average" do
    let(:book) { create(:book) }

    it "returns 'Insuficientes' when less than 3 reviews" do
      book.update!(cached_non_banned_count: 2)
      expect(book.display_average).to eq("Insuficientes")
    end

    it "returns average when 3 or more reviews" do
      book.update!(cached_non_banned_count: 3, cached_average: 4.5)
      expect(book.display_average).to eq(4.5)
    end
  end

  describe "#confidence" do
    let(:book) { create(:book) }

    it "returns 'low' for 0-2 reviews" do
      book.update!(cached_non_banned_count: 1)
      expect(book.confidence).to eq("low")
    end

    it "returns 'medium' for 3-9 reviews" do
      book.update!(cached_non_banned_count: 5)
      expect(book.confidence).to eq("medium")
    end

    it "returns 'high' for 10+ reviews" do
      book.update!(cached_non_banned_count: 15)
      expect(book.confidence).to eq("high")
    end
  end
end
