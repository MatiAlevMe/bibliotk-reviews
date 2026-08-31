require "rails_helper"

RSpec.describe Review, type: :model do
  describe "validations" do
    it { should validate_presence_of(:rating) }
    it { should validate_inclusion_of(:rating).in_range(1..5) }

    it "enforces uniqueness of user per book" do
      user = create(:user)
      book = create(:book)
      create(:review, user: user, book: book, rating: 3)

      duplicate = build(:review, user: user, book: book, rating: 4)
      expect(duplicate).not_to be_valid
    end
  end

  describe "callbacks" do
    let(:book) { create(:book) }

    describe "after_save :recalculate_book!" do
      it "recalculates book average on create" do
        create(:review, book: book, rating: 4)
        expect(book.reload.cached_average).to eq(4.0)
      end

      it "recalculates book average on update" do
        review = create(:review, book: book, rating: 4)
        review.update!(rating: 2)
        expect(book.reload.cached_average).to eq(2.0)
      end
    end

    describe "after_destroy :recalculate_book!" do
      it "recalculates book average on delete" do
        review = create(:review, book: book, rating: 4)
        review.destroy
        expect(book.reload.cached_average).to eq(0.0)
      end
    end

    describe "after_save :hide_if_user_banned!" do
      it "hides review if user is banned" do
        user = create(:user, :banned)
        review = create(:review, user: user, book: book, rating: 3)
        expect(review.reload.hidden).to be true
      end
    end
  end

  describe "single-review moderation (#hide_by_moderation!)" do
    let(:user) { create(:user) }       # NO baneado
    let(:book) { create(:book) }

    before do
      create(:review, user: user, book: book, rating: 5)
    end

    it "hides only that review, excludes it from the average, and stores the reason" do
      review = user.reviews.first
      other_user = create(:user)
      create(:review, user: other_user, book: book, rating: 1) # visible

      review.hide_by_moderation!(reason: "Spam en texto", performed_by: "moderator")

      expect(review.reload.hidden).to be true
      expect(review.moderation_reason).to eq("Spam en texto")
      expect(review.hidden_by).to eq("moderator")

      # el usuario sigue activo y su otra review no se tocó
      expect(user.reload.banned).to be false
      # promedio = solo la review visible (1.0)
      expect(book.reload.cached_average).to eq(1.0)
    end

    it "is a no-op when already hidden" do
      review = user.reviews.first
      review.hide_by_moderation!(reason: "A", performed_by: "admin")
      before = review.reload
      review.hide_by_moderation!(reason: "B", performed_by: "admin")
      expect(review.reload.moderation_reason).to eq("A") # no se sobreescribe
    end

    it "restores and clears the reason with #show_by_moderation!" do
      review = user.reviews.first
      review.hide_by_moderation!(reason: "Spam", performed_by: "admin")

      review.show_by_moderation!

      expect(review.reload.hidden).to be false
      expect(review.moderation_reason).to be_nil
      expect(review.hidden_by).to be_nil
      # vuelve a contar para el promedio (5.0 + la del otro quizá)
      expect(book.reload.cached_non_banned_count).to be >= 1
    end
  end

  describe "half-up rounding" do
    let(:book) { create(:book) }

    it "rounds half up at .25 (3.25 → 3.3)" do
      # (3+3+3+4)/4 = 13/4 = 3.25 → 3.3
      [ 3, 3, 3, 4 ].each { |r| create(:review, book: book, rating: r) }
      expect(book.reload.cached_average).to eq(3.3)
    end

    it "rounds above .3 precision up (3.35 → 3.4)" do
      # (13×3 + 7×4)/20 = 67/20 = 3.35 → 3.4
      13.times { create(:review, book: book, rating: 3) }
      7.times  { create(:review, book: book, rating: 4) }
      expect(book.reload.cached_average).to eq(3.4)
    end

    it "rounds below half down (2.24 → 2.2)" do
      # (19×2 + 6×3)/25 = 56/25 = 2.24 → 2.2
      19.times { create(:review, book: book, rating: 2) }
      6.times  { create(:review, book: book, rating: 3) }
      expect(book.reload.cached_average).to eq(2.2)
    end
  end
end
