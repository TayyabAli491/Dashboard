class PayloadSchema < ApplicationRecord
  validates :fields, presence: true
  validate :all_fields_have_required_keys

  belongs_to :workspace

  def field_keys
    fields.filter_map { |field| field["key"] || field[:key] }.map(&:to_s)
  end

  def valid_incoming_payload?(incoming_payload_hash)
    return false unless incoming_payload_hash.is_a?(Hash)

    incoming_payload_hash.keys.map(&:to_s).sort == field_keys.sort
  end

  private

  def all_fields_have_required_keys
    return if fields.blank?

    unless fields.is_a?(Array)
      errors.add(:fields, "must be an array of field definitions")
      return
    end

    allowed_types = %w[float integer string boolean]

    fields.each do |field|
      unless field.is_a?(Hash)
        errors.add(:fields, "must contain hashes with key, type, and unit")
        next
      end

      key = field["key"] || field[:key]
      type = field["type"] || field[:type]
      unit = field["unit"] || field[:unit]

      errors.add(:fields, "must include key") if key.blank?
      errors.add(:fields, "must include type") if type.blank?
      errors.add(:fields, "must include unit") if unit.blank?

      next if type.blank?

      errors.add(:fields, "type must be one of: #{allowed_types.join(', ')}") unless allowed_types.include?(type.to_s)
    end
  end
end
