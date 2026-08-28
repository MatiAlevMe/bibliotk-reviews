require "rails_helper"

RSpec.describe "GraphQL fraudAuthorAnomaly query", type: :request do
  let(:author) { "Gabriel García Márquez" }
  let(:query) do
    <<~GQL
      query($authorName: String!) {
        fraudAuthorAnomaly(authorName: $authorName) {
          suspicious
          author
          flaggedBooks
          checkedAt
        }
      }
    GQL
  end

  context "when author has no anomalies" do
    before do
      create(:book, author_name: author)
    end

    it "returns suspicious false" do
      post "/graphql", params: { query: query, variables: { authorName: author } }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      data = json.dig("data", "fraudAuthorAnomaly")
      expect(data["suspicious"]).to be false
    end
  end

  context "when author has anomaly pattern" do
    before do
      2.times do
        book = create(:book, author_name: author)
        5.times do
          user = create(:user, created_at: 1.hour.ago)
          create(:review, book: book, rating: 5, user: user)
        end
      end
    end

    it "returns suspicious true with flagged books" do
      post "/graphql", params: { query: query, variables: { authorName: author } }
      expect(response).to have_http_status(:ok)
      json = JSON.parse(response.body)
      data = json.dig("data", "fraudAuthorAnomaly")
      expect(data["suspicious"]).to be true
      expect(data["flaggedBooks"]).not_to be_empty
    end
  end
end
