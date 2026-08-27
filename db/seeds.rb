# frozen_string_literal: true

puts "Seeding database..."

# Create admin user
admin = User.find_or_create_by!(email: "admin@bibliotk.com") do |u|
  u.name = "Admin"
end

puts "Created admin user"

# Create sample authors
authors = 10.times.map do |i|
  User.find_or_create_by!(email: "author#{i + 1}@example.com") do |u|
    u.name = "Author #{i + 1}"
  end
end

puts "Created #{authors.size} authors"

# Create sample readers
readers = 50.times.map do |i|
  User.find_or_create_by!(email: "reader#{i + 1}@example.com") do |u|
    u.name = "Reader #{i + 1}"
  end
end

puts "Created #{readers.size} readers"

# Create sample books
books = 20.times.map do |i|
  Book.find_or_create_by!(title: "Book #{i + 1}") do |b|
    b.author_name = authors.sample.name
  end
end

puts "Created #{books.size} books"

# Create sample reviews
review_count = 0
books.each do |book|
  num_reviews = rand(5..50)
  readers.sample(num_reviews).each do |reader|
    Review.find_or_create_by!(user: reader, book: book) do |r|
      r.rating = rand(1..5)
      r.body = [ nil, Faker::Lorem.sentence(word_count: rand(5..20)) ].sample
    end
    review_count += 1
  end
end

puts "Created #{review_count} reviews"

# Recalculate all books
puts "Recalculating book averages..."
Book.find_each(&:recalculate!)

puts "Seeding complete!"
puts "  Users: #{User.count}"
puts "  Books: #{Book.count}"
puts "  Reviews: #{Review.count}"
