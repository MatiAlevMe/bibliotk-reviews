class CreateBooks < ActiveRecord::Migration[7.2]
  def change
    create_table :books do |t|
      t.string :title, null: false
      t.string :author_name, null: false
      t.decimal :cached_average, precision: 3, scale: 1, default: 0.0
      t.integer :cached_reviews_count, null: false, default: 0
      t.integer :cached_non_banned_count, null: false, default: 0

      t.timestamps
    end

    add_index :books, :cached_average, order: :desc
    add_index :books, :author_name
  end
end
