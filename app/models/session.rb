class Session < ApplicationRecord
  validates :name, presence: true

  belongs_to :workspace
  has_many :telemetry_records, dependent: :destroy

  scope :most_recent_first, -> { order(started_at: :desc) }

  def session_active?
    started_at.present? && ended_at.nil?
  end

  def session_completed?
    started_at.present? && ended_at.present?
  end
end
