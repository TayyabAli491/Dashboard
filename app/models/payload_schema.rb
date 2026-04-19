class PayloadSchema < ApplicationRecord
  ALLOWED_TYPES = %w[float integer numeric string boolean].freeze

  validates :fields, presence: true
  validate :validate_field_definitions

  belongs_to :workspace

  def field_keys
    fields.map { |f| f["key"].to_s }.compact_blank
  end

  def valid_incoming_payload?(incoming_payload_hash)
    return false unless incoming_payload_hash.is_a?(Hash)

    incoming_payload_hash.keys.map(&:to_s).sort == field_keys.sort
  end

  private

  def validate_field_definitions
    unless fields.is_a?(Array)
      errors.add(:fields, "must be an array of field definitions")
      return
    end

    fields.each_with_index do |field, index|
      validate_entry(field, index)
    end
  end

  def validate_entry(field, index)
    prefix = "Field ##{index + 1}"

    unless field.is_a?(Hash)
      errors.add(:fields, "#{prefix} must be a JSON object")
      return
    end

    errors.add(:fields, "#{prefix} is missing a 'key'") if field["key"].blank?

    type = field["type"]
    if type.blank?
      errors.add(:fields, "#{prefix} is missing a 'type'")
    elsif !ALLOWED_TYPES.include?(type.to_s)
      errors.add(:fields, "#{prefix} has invalid type '#{type}'. Use: #{ALLOWED_TYPES.join(', ')}")
    end
  end
end
