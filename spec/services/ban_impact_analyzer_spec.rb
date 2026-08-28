require "rails_helper"

RSpec.describe BanImpactAnalyzer do
  let(:user) { create(:user) }
  let(:book1) { create(:book) }
  let(:book2) { create(:book) }

  before do
    create(:review, user: user, book: book1, rating: 5)
    create(:review, user: user, book: book2, rating: 3)
    book1.recalculate!
    book2.recalculate!
  end

  describe "#analyze" do
    subject(:result) { described_class.new(user).analyze }

    it "returns correct total reviews" do
      expect(result[:total_reviews]).to eq(2)
    end

    it "returns correct books affected count" do
      expect(result[:books_affected]).to eq(2)
    end

    it "includes details for each affected book" do
      details = result[:details]
      expect(details.size).to eq(2)

      book1_detail = details.find { |d| d[:book_id] == book1.id }
      expect(book1_detail[:current_average]).to eq(book1.cached_average.to_f)
      expect(book1_detail[:projected_average]).to be_a(Float)
    end

    it "does not modify the database" do
      expect {
        result
      }.not_to change { book1.reload.cached_average }
    end

    it "matches the result of actually banning and recalculating" do
      preview = result
      user.ban!(reason: "spec ban")
      book1.reload
      book2.reload

      b1_proj = preview[:details].find { |d| d[:book_id] == book1.id }[:projected_average]
      b2_proj = preview[:details].find { |d| d[:book_id] == book2.id }[:projected_average]

      expect(book1.cached_average.to_f).to eq(b1_proj)
      expect(book2.cached_average.to_f).to eq(b2_proj)
    end
  end
end
