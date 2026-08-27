# frozen_string_literal: true

namespace :db do
  desc "Reset the demo database (drop, create, migrate, seed). Development/test only."
  task reset_demo: :environment do
    if Rails.env.production?
      abort "Refusing to reset the database in #{Rails.env.inspect}. db:reset_demo is only for development and test."
    end

    puts "Resetting database in #{Rails.env} environment (RAILS_ENV=#{ENV.fetch('RAILS_ENV', nil).inspect})..."
    Rake::Task["db:drop"].invoke
    Rake::Task["db:create"].invoke
    Rake::Task["db:migrate"].invoke
    Rake::Task["db:seed"].invoke
    puts "Database reset complete. Back to factory state."
  end
end
