class Workspace < ApplicationRecord
  validates :name, presence: true
  validates :api_key, presence: true, uniqueness: true

  belongs_to :user
  has_one :payload_schema, dependent: :destroy
  has_many :sessions, dependent: :destroy
  has_many :telemetry_records, dependent: :destroy
  has_one_attached :background_video

  scope :belonging_to_user, ->(user) { where(user: user) }
  before_validation :generate_unique_api_key, on: :create

  def regenerate_api_key!
    loop do
      self.api_key = SecureRandom.hex(20)
      break unless self.class.where.not(id: id).exists?(api_key: api_key)
    end

    save!
  end

  def telemetry_record_count
    telemetry_records.count
  end

  def payload_schema_defined?
    payload_schema.present? && payload_schema.fields.count.positive?
  end

  def setup_complete?
    payload_schema_defined? && telemetry_records.exists?
  end

  def awaiting_first_data?
    payload_schema_defined? && !telemetry_records.exists?
  end

  def schema_missing?
    !payload_schema_defined?
  end

  def parsed_dashboard_widgets
    return [] unless dashboard_layout.is_a?(Array)

    dashboard_layout.filter_map { |raw| DashboardWidgetCatalog.normalize_widget(raw) }
  end

  private

  def generate_unique_api_key
    return if api_key.present?

    loop do
      self.api_key = SecureRandom.hex(20)
      break unless self.class.exists?(api_key: api_key)
    end
  end
end
