class BanAuditLog < ApplicationRecord
  belongs_to :user

  enum :action, { banned: 0, unbanned: 1 }

  validates :action, presence: true
  validates :books_affected, presence: true, numericality: { greater_than_or_equal_to: 0 }
  validates :impact_details, presence: true
end
