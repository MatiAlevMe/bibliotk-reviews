class CreateModerationNotifications < ActiveRecord::Migration[7.2]
  def change
    create_table :moderation_notifications do |t|
      t.references :user, null: false, foreign_key: true
      t.references :book, null: false, foreign_key: true
      t.decimal :previous_average, precision: 3, scale: 1, null: false
      t.decimal :new_average, precision: 3, scale: 1, null: false
      t.text :reason, null: false
      t.datetime :read_at

      t.timestamps
    end

    add_index :moderation_notifications, :read_at
  end
end
