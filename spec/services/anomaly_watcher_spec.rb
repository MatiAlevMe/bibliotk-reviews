require "rails_helper"

RSpec.describe AnomalyWatcher do
  let(:book) { create(:book) }

  describe "#check_review_bursts" do
    context "when reviews in last hour exceed threshold" do
      before do
        users = create_list(:user, 5)
        users.each do |user|
          create(:review, book: book, user: user, created_at: 10.minutes.ago)
        end
      end

      it "flags the book when count > threshold" do
        alerts = described_class.new.check_review_bursts(threshold: 4)
        expect(alerts.size).to eq(1)
        expect(alerts.first[:book_id]).to eq(book.id)
        expect(alerts.first[:target]).to eq("moderation")
      end

      it "does not flag when count is below threshold" do
        alerts = described_class.new.check_review_bursts(threshold: 10)
        expect(alerts).to be_empty
      end
    end
  end

  describe "#check_average_deltas" do
    let(:author) { create(:user) }

    context "when a notification indicates delta > 1.0" do
      before do
        create(
          :moderation_notification,
          user: author,
          book: book,
          previous_average: 4.5,
          new_average: 2.5,
          created_at: 2.hours.ago
        )
      end

      it "reports an average delta alert" do
        alerts = described_class.new.check_average_deltas
        expect(alerts.size).to eq(1)
        expect(alerts.first[:delta]).to eq(-2.0)
        expect(alerts.first[:target]).to eq("moderation")
      end
    end
  end

  describe "#check_banned_ratio" do
    context "when banned reviewers ratio exceeds 5%" do
      before do
        banned_user = create(:user, banned: true)
        normal_users = create_list(:user, 10)

        create(:review, user: banned_user, book: book, created_at: 1.day.ago)
        normal_users.each do |u|
          create(:review, user: u, book: book, created_at: 2.days.ago)
        end
      end

      it "triggers alert for growth" do
        result = described_class.new.check_banned_ratio(threshold: 0.05)
        expect(result[:alert]).to be true
        expect(result[:target]).to eq("growth")
        expect(result[:banned_reviewers]).to eq(1)
        expect(result[:total_reviewers]).to eq(11)
      end
    end
  end

  describe ".scan" do
    it "returns a consolidated report hash" do
      report = described_class.scan
      expect(report).to include(:burst_alerts, :average_delta_alerts, :banned_ratio_alert, :scanned_at)
    end
  end
end
