# frozen_string_literal: true

puts "Seeding database..."

# ============================================================================
# ADMIN
# ============================================================================
admin = User.find_or_create_by!(email: "admin@bibliotk.com") do |u|
  u.name = "Admin"
end
puts "Admin: #{admin.email}"

# ============================================================================
# AUTHORS (each has books)
# ============================================================================
author_data = [
  { name: "Gabriel García Márquez", email: "garcia@books.com" },
  { name: "Julio Cortázar", email: "cortazar@books.com" },
  { name: "Jorge Luis Borges", email: "borges@books.com" },
  { name: "Isabel Allende", email: "allende@books.com" },
  { name: "Mario Vargas Llosa", email: "vargas@books.com" }
]

authors = author_data.map do |data|
  User.find_or_create_by!(email: data[:email]) do |u|
    u.name = data[:name]
  end
end
puts "Authors: #{authors.map(&:name).join(', ')}"

# ============================================================================
# BOOKS (specific titles per author)
# ============================================================================
book_data = [
  { title: "Cien años de soledad", author_name: "Gabriel García Márquez" },
  { title: "El amor en los tiempos del cólera", author_name: "Gabriel García Márquez" },
  { title: "Rayuela", author_name: "Julio Cortázar" },
  { title: "Bestiario", author_name: "Julio Cortázar" },
  { title: "Ficciones", author_name: "Jorge Luis Borges" },
  { title: "El Aleph", author_name: "Jorge Luis Borges" },
  { title: "La casa de los espíritus", author_name: "Isabel Allende" },
  { title: "Eva Luna", author_name: "Isabel Allende" },
  { title: "La ciudad y los perros", author_name: "Mario Vargas Llosa" },
  { title: "Conversación en La Catedral", author_name: "Mario Vargas Llosa" }
]

books = book_data.map do |data|
  Book.find_or_create_by!(title: data[:title]) do |b|
    b.author_name = data[:author_name]
  end
end
puts "Books: #{books.size}"

# ============================================================================
# READERS (50 users with known IDs for testing)
# ============================================================================
readers = 50.times.map do |i|
  User.find_or_create_by!(email: "reader#{i + 1}@test.com") do |u|
    u.name = "Reader #{i + 1}"
  end
end
puts "Readers: #{readers.size}"

# ============================================================================
# REVIEWS (each reader reviews 3-6 random books)
# ============================================================================
review_count = 0
readers.each do |reader|
  books.sample(rand(3..6)).each do |book|
    Review.find_or_create_by!(user: reader, book: book) do |r|
      r.rating = rand(1..5)
      r.body = [ nil, Faker::Lorem.sentence(word_count: rand(5..20)) ].sample
    end
    review_count += 1
  end
end
puts "Reviews: #{review_count}"

# ============================================================================
# RECALCULATE ALL
# ============================================================================
puts "Recalculating book averages..."
Book.find_each(&:recalculate!)

# ============================================================================
# SUMMARY
# ============================================================================
puts "\n" + "=" * 60
puts "SEED COMPLETE"
puts "=" * 60
puts ""
puts "Users:  #{User.count}"
puts "Books:  #{Book.count}"
puts "Reviews: #{Review.count}"
puts ""
puts "Test accounts:"
puts "  Admin:     admin@bibliotk.com"
puts "  Authors:   #{author_data.map { |a| a[:email] }.join(', ')}"
puts "  Readers:   reader1@test.com ... reader50@test.com"
puts ""
puts "Book IDs for testing:"
Book.find_each { |b| puts "  ID #{b.id}: #{b.title} (#{b.cached_average}★, #{b.cached_reviews_count} reviews)" }
