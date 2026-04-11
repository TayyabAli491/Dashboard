class CreatePayloadSchemas < ActiveRecord::Migration[8.1]
  def change
    create_table :payload_schemas do |t|
      t.references :workspace, null: false, foreign_key: true, index: { unique: true }
      t.jsonb :fields, null: false, default: []

      t.timestamps
    end
  end
end
