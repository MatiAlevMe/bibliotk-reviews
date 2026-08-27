class ModerationNotification < ApplicationRecord
  belongs_to :user
  belongs_to :book

  validates :previous_average, presence: true
  validates :new_average, presence: true
  validates :reason, presence: true

  scope :unread, -> { where(read_at: nil) }
  scope :read, -> { where.not(read_at: nil) }

  def mark_as_read!
    update!(read_at: Time.current) if read_at.nil?
  end
end
