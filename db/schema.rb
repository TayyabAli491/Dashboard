# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_04_11_102403) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "payload_schemas", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "fields", default: [], null: false
    t.datetime "updated_at", null: false
    t.bigint "workspace_id", null: false
    t.index ["workspace_id"], name: "index_payload_schemas_on_workspace_id", unique: true
  end

  create_table "sessions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.datetime "ended_at"
    t.string "name", null: false
    t.datetime "started_at"
    t.datetime "updated_at", null: false
    t.bigint "workspace_id", null: false
    t.index ["workspace_id"], name: "index_sessions_on_workspace_id"
  end

  create_table "telemetry_records", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.jsonb "processed_payload", default: {}
    t.jsonb "raw_payload", default: {}, null: false
    t.datetime "recorded_at", null: false
    t.bigint "session_id"
    t.datetime "updated_at", null: false
    t.bigint "workspace_id", null: false
    t.index ["recorded_at"], name: "index_telemetry_records_on_recorded_at"
    t.index ["session_id"], name: "index_telemetry_records_on_session_id"
    t.index ["workspace_id"], name: "index_telemetry_records_on_workspace_id"
  end

  create_table "users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.datetime "remember_created_at"
    t.datetime "reset_password_sent_at"
    t.string "reset_password_token"
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
  end

  create_table "workspaces", force: :cascade do |t|
    t.string "api_key", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.boolean "is_public", default: false, null: false
    t.string "name", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["api_key"], name: "index_workspaces_on_api_key", unique: true
    t.index ["user_id"], name: "index_workspaces_on_user_id"
  end

  add_foreign_key "payload_schemas", "workspaces"
  add_foreign_key "sessions", "workspaces"
  add_foreign_key "telemetry_records", "sessions"
  add_foreign_key "telemetry_records", "workspaces"
  add_foreign_key "workspaces", "users"
end
