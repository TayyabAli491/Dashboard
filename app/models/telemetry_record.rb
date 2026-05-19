class TelemetryRecord < ApplicationRecord
  validates :raw_payload, presence: true
  validates :recorded_at, presence: true

  belongs_to :workspace
  belongs_to :session, optional: true

  after_create_commit :broadcast_to_workspace_channel

  scope :most_recent_first, -> { order(recorded_at: :desc) }
  scope :recorded_between, ->(start_time, end_time) { where(recorded_at: start_time..end_time) }

  def value_for_field(field_key)
    return raw_payload[field_key.to_s] if processed_payload.blank?

    processed_payload[field_key.to_s]
  end

  private

  def broadcast_to_workspace_channel
    ActionCable.server.broadcast(
      "workspace_telemetry_#{workspace_id}",
      {
        id:                id,
        recorded_at:       recorded_at,
        raw_payload:       raw_payload,
        processed_payload: processed_payload
      }
    )
  end
end
