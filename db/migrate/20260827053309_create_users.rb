class CreateUsers < ActiveRecord::Migration[7.2]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.boolean :banned, null: false, default: false
      t.datetime :banned_at
      t.text :ban_reason

      t.timestamps
    end

    add_index :users, :email, unique: true
    add_index :users, :banned
  end
end
