require "rails_helper"

RSpec.describe "GraphQL moderationStatus query", type: :request do
  let(:query) do
    <<~GQL
      query($bookId: ID!) {
        moderationStatus(bookId: $bookId) {
          bookId
          title
          hiddenCount
          hiddenReviews { id userId userName rating hiddenAt banReason }
        }
      }
    GQL
  end

  context "when a reader review was hidden individually" do
    let!(:reader) { create(:user) }
    let!(:book) { create(:book) }

    before do
      create(:review, user: reader, book: book, rating: 5)
      review = Review.last
      review.hide_by_moderation!(reason: "Contenido inapropiado", performed_by: "admin")
    end

    it "exposes the hidden review with per-review moderation_reason and userId" do
      post "/graphql", params: { query: query, variables: { bookId: book.id } }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      data = json.dig("data", "moderationStatus")
      expect(data["title"]).to eq(book.title)
      expect(data["hiddenCount"]).to eq(1)
      hidden = data["hiddenReviews"].first
      expect(hidden["userId"]).to eq(reader.id.to_s)
      expect(hidden["userName"]).to eq(reader.name)
      expect(hidden["banReason"]).to eq("Contenido inapropiado")
    end
  end
end
