class AddReviewsSumAndCountRawToBooks < ActiveRecord::Migration[7.2]
  def change
    add_column :books, :reviews_sum, :integer, default: 0, null: false
    add_column :books, :reviews_count_raw, :integer, default: 0, null: false
  end
end
