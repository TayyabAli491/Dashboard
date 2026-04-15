# MiniSat-Alpha — Project Instructions

## Stack
- Ruby on Rails 8.1.3
- ERB views
- Stimulus.js + Hotwire (Turbo Frames + Turbo Streams)
- Tailwind CSS
- PostgreSQL
- ActionCable for WebSockets
- Devise for authentication

## Architecture
- Multi-tenant: every resource scoped to current_user
- Workspaces represent IoT projects
- Each workspace has a dynamic PayloadSchema (jsonb)
- IoT devices POST telemetry via secret API key
- Dashboard built with drag-and-drop widgets bound to payload fields

## Rails Conventions
- Follow Rails 8.1.3 conventions strictly, no deprecated syntax
- Fat models, thin controllers
- Controllers only handle request/response flow — no business logic
- Business logic lives in models or service objects under app/services
- Use before_action for shared setup and authorization
- All controller actions scope queries to current_user — never expose other users data
- Use Turbo Frames for modals and inline forms
- Use Turbo Streams for real-time DOM updates
- API endpoints live under namespace :api

## Naming Conventions (Basecamp style)
- Variable names must be descriptive and reveal intent
  - Good: telemetry_records_for_today, workspace_api_key, active_flight
  - Bad: data, result, temp, val, x
- Method names describe what the method returns, not what it does
  - Good: latest_telemetry_record, payload_field_keys, flight_in_progress?
  - Bad: get_data, fetch_record, process, handle
- Boolean methods end in ? and read as true/false questions
  - Good: public_workspace?, flight_active?, payload_valid?
- Methods that change state use imperative verbs
  - Good: activate_flight!, archive_workspace!, regenerate_api_key!
- Service objects named as verb phrases describing their job
  - Good: ValidateTelemetryPayload, BroadcastTelemetryRecord, DenoiseSensorReading

## Code Style (Basecamp style)
- No abbreviations in variable or method names
- One level of abstraction per method — if a method does two things, split it
- Avoid else when an early return is possible
- No comments explaining what code does — code should be self-explanatory
- Comments only for why, never for what
- Keep methods under 10 lines
- Keep controllers under 100 lines
- Extract repeated logic into a well-named private method immediately
- Avoid double negatives in conditionals
  - Good: if workspace.public?
  - Bad: if !workspace.not_public?

## Model Rules
- Validations at the top of the model
- Associations next
- Scopes after associations
- Public methods after scopes
- Private methods at the bottom
- Scopes must be named to read as filtering criteria
  - Good: scope :with_active_flight, scope :created_this_week
- Use callbacks sparingly — prefer explicit service calls over hidden callbacks
- after_create_commit only for ActionCable broadcasts

## Service Objects
- Live in app/services
- One public method: call
- Initializer receives only what it needs, nothing more
- Returns a result object or raises a domain-specific error
- Example structure:
  class ValidateTelemetryPayload
    def initialize(workspace:, raw_payload:)
      @workspace = workspace
      @raw_payload = raw_payload
    end
    def call
      # validation logic here
    end
    private
    attr_reader :workspace, :raw_payload
  end

## Styling Rules
- Tailwind only — no custom CSS files, no inline styles

## Models Overview
- User (Devise) → has_many :workspaces
- Workspace → has_one :payload_schema, has_many :flights, has_many :telemetry_records
- PayloadSchema → fields jsonb (array of {key, type, unit, alias})
- Flight → belongs_to :workspace, has_many :telemetry_records
- TelemetryRecord → belongs_to :workspace, raw_payload jsonb, processed_payload jsonb

# Do Not
- write test case, create their files
