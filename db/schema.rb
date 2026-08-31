# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_08_31_200000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "plpgsql"

  create_table "ban_audit_logs", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.integer "action", null: false
    t.integer "books_affected", default: 0, null: false
    t.jsonb "impact_details", default: {}, null: false
    t.string "performed_by"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["action"], name: "index_ban_audit_logs_on_action"
    t.index ["user_id"], name: "index_ban_audit_logs_on_user_id"
  end

  create_table "books", force: :cascade do |t|
    t.string "title", null: false
    t.string "author_name", null: false
    t.decimal "cached_average", precision: 3, scale: 1, default: "0.0"
    t.integer "cached_reviews_count", default: 0, null: false
    t.integer "cached_non_banned_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "reviews_sum", default: 0, null: false
    t.integer "reviews_count_raw", default: 0, null: false
    t.index ["author_name"], name: "index_books_on_author_name"
    t.index ["cached_average"], name: "index_books_on_cached_average", order: :desc
  end

  create_table "moderation_notifications", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "book_id", null: false
    t.decimal "previous_average", precision: 3, scale: 1, null: false
    t.decimal "new_average", precision: 3, scale: 1, null: false
    t.text "reason", null: false
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["book_id"], name: "index_moderation_notifications_on_book_id"
    t.index ["read_at"], name: "index_moderation_notifications_on_read_at"
    t.index ["user_id"], name: "index_moderation_notifications_on_user_id"
  end

  create_table "reviews", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.bigint "book_id", null: false
    t.integer "rating", null: false
    t.text "body"
    t.boolean "hidden", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "moderation_reason"
    t.string "hidden_by"
    t.index ["book_id"], name: "index_reviews_on_book_id"
    t.index ["hidden"], name: "index_reviews_on_hidden"
    t.index ["user_id", "book_id"], name: "index_reviews_on_user_id_and_book_id", unique: true
    t.index ["user_id"], name: "index_reviews_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "name", null: false
    t.string "email", null: false
    t.boolean "banned", default: false, null: false
    t.datetime "banned_at"
    t.text "ban_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["banned"], name: "index_users_on_banned"
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "ban_audit_logs", "users"
  add_foreign_key "moderation_notifications", "books"
  add_foreign_key "moderation_notifications", "users"
  add_foreign_key "reviews", "books"
  add_foreign_key "reviews", "users"
end
