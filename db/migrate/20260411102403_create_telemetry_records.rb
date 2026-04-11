class CreateTelemetryRecords < ActiveRecord::Migration[8.1]
  def change
    create_table :telemetry_records do |t|
      t.references :workspace, null: false, foreign_key: true, index: true
      t.references :session, foreign_key: true, index: true
      t.jsonb :raw_payload, null: false, default: {}
      t.jsonb :processed_payload, default: {}
      t.datetime :recorded_at, null: false

      t.timestamps
    end

    add_index :telemetry_records, :recorded_at
  end
end
