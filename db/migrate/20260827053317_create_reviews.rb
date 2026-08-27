class CreateReviews < ActiveRecord::Migration[7.2]
  def change
    create_table :reviews do |t|
      t.references :user, null: false, foreign_key: true
      t.references :book, null: false, foreign_key: true
      t.integer :rating, null: false
      t.text :body
      t.boolean :hidden, null: false, default: false

      t.timestamps
    end

    add_index :reviews, [ :user_id, :book_id ], unique: true
    add_index :reviews, :hidden
  end
end
