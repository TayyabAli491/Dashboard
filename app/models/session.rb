class Session < ApplicationRecord
  validates :name, presence: true

  belongs_to :workspace
  has_many :telemetry_records, dependent: :nullify

  scope :most_recent_first, -> { order(started_at: :desc) }

  def duration_in_seconds
    return nil unless session_completed?

    ended_at - started_at
  end

  def telemetry_record_count
    telemetry_records.count
  end

  def session_active?
    started_at.present? && ended_at.nil?
  end

  def session_completed?
    started_at.present? && ended_at.present?
  end
end
