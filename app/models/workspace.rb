class Workspace < ApplicationRecord
  validates :name, presence: true
  validates :api_key, presence: true, uniqueness: true

  belongs_to :user
  has_one :payload_schema, dependent: :destroy
  has_many :sessions, dependent: :destroy
  has_many :telemetry_records, dependent: :destroy

  scope :belonging_to_user, ->(user) { where(user: user) }
  before_create :generate_unique_api_key

  def payload_schema_defined?
    payload_schema.present? && payload_schema.fields.count.positive?
  end

  private

  def generate_unique_api_key
    loop do
      self.api_key = SecureRandom.hex(20)
      break unless self.class.exists?(api_key: api_key)
    end
  end
end
