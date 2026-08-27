# frozen_string_literal: true

namespace :db do
  namespace :seed do
    desc "Generate a book with 500,000 reviews for benchmarking"
    task large_scale: :environment do
      puts "Generating large-scale seed data..."

      # Create a special book
      book = Book.find_or_create_by!(title: "Benchmark Book (500k Reviews)") do |b|
        b.author_name = "Benchmark Author"
      end

      puts "Created book: #{book.title}"

      # Create users in batches
      user_batch_size = 1000
      total_users = 500_000
      created_users = 0

      puts "Creating #{total_users} users..."

      total_users.times.each_slice(user_batch_size) do |batch|
        users = batch.map do |i|
          {
            name: "User #{i}",
            email: "user#{i}@benchmark.com",
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        User.insert_all(users)
        created_users += batch.size
        print "\r  Users: #{created_users}/#{total_users}" if (created_users % 10_000).zero?
      end

      puts "\nCreated #{User.where(email: "user*@benchmark.com").count} users"

      # Create reviews in batches
      review_batch_size = 1000
      total_reviews = 500_000
      created_reviews = 0

      user_ids = User.where("email LIKE ?", "user%@benchmark.com").pluck(:id)

      puts "Creating #{total_reviews} reviews..."

      total_reviews.times.each_slice(review_batch_size) do |batch|
        reviews = batch.map.with_index do |_, i|
          {
            user_id: user_ids[i % user_ids.size],
            book_id: book.id,
            rating: rand(1..5),
            hidden: false,
            created_at: Time.current,
            updated_at: Time.current
          }
        end

        Review.insert_all(reviews)
        created_reviews += batch.size
        print "\r  Reviews: #{created_reviews}/#{total_reviews}" if (created_reviews % 10_000).zero?
      end

      puts "\nCreated #{Review.where(book: book).count} reviews"

      # Recalculate book
      puts "Recalculating book average..."
      book.recalculate!

      puts "Done!"
      puts "  Book: #{book.title}"
      puts "  Total reviews: #{book.reload.cached_reviews_count}"
      puts "  Average: #{book.cached_average}"
    end

    desc "Recalculate all book averages"
    task recalculate_all: :environment do
      puts "Recalculating all book averages..."

      Book.find_each do |book|
        book.recalculate!
        print "."
      end

      puts "\nDone! Recalculated #{Book.count} books."
    end
  end
end
