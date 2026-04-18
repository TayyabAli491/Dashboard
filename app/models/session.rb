class Session < ApplicationRecord
  validates :name, presence: true

  belongs_to :workspace
  has_many :telemetry_records, dependent: :nullify

  enum :status, { pending: 0, in_progress: 1, completed: 2 }

  scope :most_recent_first, -> { order(started_at: :desc) }

  def duration_in_seconds
    return nil unless completed?

    ended_at - started_at
  end

  def telemetry_record_count
    telemetry_records.count
  end
end
