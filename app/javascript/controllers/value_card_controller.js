import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"

export default class extends Controller {
  static targets = ["value", "unit", "trend"]
  static values  = {
    field:       String,
    workspaceId: Number,
    color:       String
  }

  connect() {
    this.previousValue = null
    this.subscription = consumer.subscriptions.create(
      {
        channel: "WorkspaceTelemetryChannel",
        workspace_id: this.workspaceIdValue
      },
      { received: (data) => this.handlePacket(data) }
    )
  }

  disconnect() {
    this.subscription?.unsubscribe()
  }

  handlePacket(data) {
    const payload = data.processed_payload ||
                    data.raw_payload
    const raw     = data.raw_payload
    const field   = this.fieldValue

    if (payload[field] === undefined) return

    const current  = parseFloat(payload[field])
    const previous = this.previousValue

    this.valueTarget.textContent =
      Number.isInteger(current) ?
      current : current.toFixed(2)

    if (previous !== null) {
      const diff = current - previous
      if (diff > 0) {
        this.trendTarget.textContent = `↑ ${diff.toFixed(2)}`
        this.trendTarget.className = "text-sm text-success"
      } else if (diff < 0) {
        this.trendTarget.textContent = `↓ ${Math.abs(diff).toFixed(2)}`
        this.trendTarget.className = "text-sm text-danger"
      } else {
        this.trendTarget.textContent = "→ stable"
        this.trendTarget.className = "text-sm text-text-muted"
      }
    }

    this.previousValue = current
  }
}
