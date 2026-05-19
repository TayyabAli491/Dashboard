# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start development server (Puma + Tailwind CSS watcher)
bin/dev

# Database
bin/rails db:migrate
bin/rails db:seed          # seeds demo user, 3 workspaces, sessions, and telemetry records

# Tests
bin/rails test                          # all tests
bin/rails test test/models/user_test.rb # single file

# Linting / security
bin/rubocop
bin/brakeman
bin/bundler-audit

# Serial telemetry bridge (hardware → dashboard)
python3 script/serial_telemetry_bridge.py \
  --port /dev/cu.usbmodem14101 \
  --url http://127.0.0.1:3000/api/workspaces/1/telemetry \
  --api-key <workspace_api_key>
```

`Procfile.dev` only runs the Tailwind CSS watcher; Puma is started by `bin/dev` (via `bin/rails server`).

## Architecture

### Stack
Rails 8.1.3 · PostgreSQL · Hotwire (Turbo + Stimulus) · TailwindCSS · ImportMaps · ActionCable via Solid Cable · Devise authentication

### Domain model

```
User
└── Workspace (api_key, dashboard_layout JSONB, dashboard_theme)
    ├── PayloadSchema (fields JSONB — defines telemetry keys/types)
    ├── Session (pending | in_progress | completed)
    │   └── TelemetryRecord (raw_payload JSONB, processed_payload JSONB)
    └── TelemetryRecord (workspace-level, nullable session FK)
```

A workspace has **one** `PayloadSchema` that declares the expected field names and types (float, integer, string, boolean). Incoming telemetry keys are matched against `PayloadSchema#field_keys`. `TelemetryRecord` is attached to both a workspace and optionally the currently active `Session` (status `in_progress`) at the time of ingestion.

### Hardware → Dashboard data flow

1. **ESP32-S3 satellite** sends `SensorPacket` and `ImageChunk` structs via ESP-NOW to the **ESP32-WROOM ground station** (`firmware/ground_station/ground_station.ino`).
2. The ground station emits each packet over USB serial as `TELEM_JSON:<json>`.
3. **`script/serial_telemetry_bridge.py`** reads those lines and POSTs the JSON to `POST /api/workspaces/:id/telemetry` with `X-API-Key` header.
4. `Api::WorkspacesController#telemetry` authenticates via the workspace `api_key`, saves a `TelemetryRecord`, then broadcasts it over ActionCable to `"workspace_telemetry_#{workspace.id}"`.
5. **`WorkspaceTelemetryChannel`** streams that broadcast to authenticated browser subscribers.
6. In the browser, `dashboard_controller.js` (Stimulus) receives the ActionCable message and dispatches a `telemetry:received` custom event on `window`.
7. Individual widget Stimulus controllers (`live_telemetry`, `attitude_3d`, `compass_3d`, `gauge_chart`, `gps_map`, `line_chart`, `value_card`) listen for `telemetry:received` and self-update from `event.detail` (the raw payload hash).

Image data follows the same path but through `Api::WorkspacesController#images` → `"workspace_camera_#{workspace.id}"` ActionCable channel → `camera_feed_controller.js`. Images are **not** persisted to the database; they are relayed directly via the websocket.

### Workspace setup flow

New workspaces go through a multi-step setup rendered in `app/views/workspaces/states/`:
1. **Onboarding** (`_onboarding`) → create workspace
2. **Payload schema** (`payload_schemas#new/edit`) → define field keys and types
3. **Device connect** (`_device_connect`) → copy `api_key`, configure hardware
4. **Dashboard designer** (`_dashboard_designer`) → drag-and-drop GridStack layout
5. **Live dashboard** (`workspaces#live_dashboard`) → read-only view with live WebSocket feed

`Workspace` exposes state-check helpers: `schema_missing?`, `awaiting_first_data?`, `setup_complete?`, `parsed_dashboard_widgets`.

### Dashboard layout

`dashboard_layout` is a JSONB array stored on `Workspace`. Each element:
```json
{ "id": "widget_123", "type": "GPS Map", "label": "GPS Map", "grid": { "x": 0, "y": 0, "w": 4, "h": 4 } }
```
The designer uses **GridStack.js** (loaded via importmap). `dashboard_controller.js` initialises the grid, handles add/remove widget events, and PATCHes `save_layout` to persist both layout and theme. In live mode (`editModeValue: false`) the same controller also connects the ActionCable subscription.

Widget partials live in `app/views/widgets/` (reusable components) and `app/views/workspaces/widgets/` (workspace-specific widgets). Each widget type has a corresponding Stimulus controller in `app/javascript/controllers/`.

### API authentication

Hardware endpoints (`POST /api/workspaces/:id/telemetry`, `POST /api/workspaces/:id/images`) skip CSRF and Devise session checks. Authentication is done via `X-API-Key` request header matched against `Workspace#api_key`. API key is regenerated via `Workspace#regenerate_api_key!`.

### ActionCable

Uses Solid Cable (database-backed, no Redis needed). Cable connection authentication is in `app/channels/application_cable/connection.rb` via Devise's `warden`. Two named channels:
- `workspace_telemetry_#{workspace.id}` — telemetry records
- `workspace_camera_#{workspace.id}` — raw image frames

### Seed data

`bin/rails db:seed` creates `demo@drift.local / password123` with three workspaces (CanSat Atlas, Borealis, Cirrus), each having a `PayloadSchema`, one completed session, and one in-progress session with simulated flight telemetry records.

## Conventions

### Rails

- Fat models, thin controllers — no business logic in controllers
- Controllers only handle request/response flow; scope all queries to `current_user`
- Business logic lives in models or service objects under `app/services/`
- Use `before_action` for shared setup and authorization
- Turbo Frames for modals and inline forms; Turbo Streams for real-time DOM updates
- API endpoints live under the `api` namespace

### Naming (Basecamp style)

- Variable and method names must be descriptive and reveal intent (`telemetry_records_for_today`, not `data`)
- Methods named for what they return, not what they do (`latest_telemetry_record`, not `get_data`)
- Boolean methods end in `?` and read as true/false questions (`flight_active?`, `payload_valid?`)
- State-changing methods use imperative verbs with `!` (`activate_flight!`, `regenerate_api_key!`)
- Service objects named as verb phrases (`ValidateTelemetryPayload`, `BroadcastTelemetryRecord`)
- No abbreviations anywhere

### Code style

- One level of abstraction per method — if a method does two things, split it
- Prefer early return over `else`
- Keep methods under 10 lines, controllers under 100 lines
- Extract repeated logic into a well-named private method immediately
- Avoid double negatives in conditionals (`if workspace.public?` not `if !workspace.not_public?`)

### Model layout order

1. Validations
2. Associations
3. Scopes (named as filtering criteria: `scope :with_active_flight`, not `scope :active`)
4. Public methods
5. Private methods

Use callbacks sparingly — prefer explicit service calls. `after_create_commit` only for ActionCable broadcasts.

### Service objects

Live in `app/services/`. One public method (`call`). Initializer receives only what it needs. Returns a result object or raises a domain-specific error.

```ruby
class ValidateTelemetryPayload
  def initialize(workspace:, raw_payload:)
    @workspace    = workspace
    @raw_payload  = raw_payload
  end

  def call
    # validation logic
  end

  private

  attr_reader :workspace, :raw_payload
end
```

### Styling

Use Tailwind only — no inline styles. Reuse existing custom CSS classes; design new ones with reusability in mind.

## Do not

- Write or create test files
