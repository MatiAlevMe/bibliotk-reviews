require "rails_helper"

RSpec.describe User, type: :model do
  describe "validations" do
    it { should validate_presence_of(:name) }
    it { should validate_presence_of(:email) }

    it "enforces email uniqueness" do
      create(:user, email: "test@example.com")
      duplicate = build(:user, email: "test@example.com")
      expect(duplicate).not_to be_valid
    end
  end

  describe "#ban!" do
    let(:user) { create(:user) }
    let!(:author) { create(:user, name: "Book Author") }
    let(:book1) { create(:book, author_name: "Book Author") }
    let(:book2) { create(:book, author_name: "Book Author") }

    before do
      create(:review, user: user, book: book1, rating: 5)
      create(:review, user: user, book: book2, rating: 4)
    end

    it "marks user as banned" do
      user.ban!(reason: "Spam")
      expect(user.reload.banned).to be true
      expect(user.ban_reason).to eq("Spam")
      expect(user.banned_at).not_to be_nil
    end

    it "hides all user reviews" do
      user.ban!(reason: "Spam")
      expect(user.reviews.pluck(:hidden)).to all(be true)
    end

    it "recalculates all affected books" do
      user.ban!(reason: "Spam")
      expect(book1.reload.cached_average).to eq(0.0)
      expect(book2.reload.cached_average).to eq(0.0)
    end

    it "creates ban audit log" do
      expect {
        user.ban!(reason: "Spam", performed_by: "admin")
      }.to change(BanAuditLog, :count).by(1)

      log = user.ban_audit_logs.last
      expect(log.action).to eq("banned")
      expect(log.books_affected).to eq(2)
      expect(log.performed_by).to eq("admin")
    end

    it "creates moderation notifications for book authors" do
      expect {
        user.ban!(reason: "Spam")
      }.to change(ModerationNotification, :count).by(4) # 2 autores + 2 avisos al baneado

      expect(ModerationNotification.where(user: author).count).to eq(2)
    end

    it "notifies the banned user that their reviews were hidden" do
      user.ban!(reason: "Spam")

      mine = ModerationNotification.where(user: user)
      expect(mine.count).to eq(2)
      expect(mine.first.reason).to include("quedó oculta por moderación")
      expect(mine.first.reason).to include("Spam")
    end
  end

  describe "#unban!" do
    let(:user) { create(:user, :banned) }
    let!(:author) { create(:user, name: "Book Author") }
    let(:book) { create(:book, author_name: "Book Author") }

    before do
      review = create(:review, user: user, book: book, rating: 5)
      review.update_column(:hidden, true)
      book.update_columns(cached_average: 0.0, cached_non_banned_count: 0)
    end

    it "marks user as not banned" do
      user.unban!
      expect(user.reload.banned).to be false
      expect(user.ban_reason).to be_nil
      expect(user.banned_at).to be_nil
    end

    it "unhides all user reviews" do
      user.unban!
      expect(user.reviews.pluck(:hidden)).to all(be false)
    end

    it "recalculates affected books" do
      user.unban!
      expect(book.reload.cached_average).to eq(5.0)
    end

    it "creates unban audit log" do
      expect {
        user.unban!(performed_by: "admin")
      }.to change(BanAuditLog, :count).by(1)

      log = user.ban_audit_logs.last
      expect(log.action).to eq("unbanned")
    end
  end
end
