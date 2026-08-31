class AddModerationFieldsToReviews < ActiveRecord::Migration[7.2]
  def change
    add_column :reviews, :moderation_reason, :string
    add_column :reviews, :hidden_by, :string
  end
end