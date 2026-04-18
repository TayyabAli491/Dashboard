import { Controller } from "@hotwired/stimulus"
import consumer from "../channels/consumer"
import Chart from "chart.js"

const COLOR_MAP = {
  primary: "#6366F1",
  cyan: "#06B6D4",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444"
}

export default class extends Controller {
  static targets = ["readout"]
  static values  = {
    field:       String,
    workspaceId: Number,
    min:         Number,
    max:         Number,
    color:       String
  }

  connect() {
    const accent = COLOR_MAP[this.colorValue] || 
                   COLOR_MAP.primary

    this.chart = new Chart(this.element, {
      type: "doughnut",
      data: {
        datasets: [{
          data: [0, this.maxValue],
          backgroundColor: [
            accent,
            "rgba(255,255,255,0.05)"
          ],
          borderWidth: 0,
          circumference: 180,
          rotation: 270
        }]
      },
      options: {
        responsive: false,
        cutout: "75%",
        plugins: { legend: { display: false } },
        animation: { duration: 400 }
      }
    })

    this.subscription = consumer.subscriptions.create(
      {
        channel: "WorkspaceTelemetryChannel",
        workspace_id: this.workspaceIdValue
      },
      { received: (data) => this.handlePacket(data) }
    )
  }

  disconnect() {
    this.chart?.destroy()
    this.subscription?.unsubscribe()
  }

  handlePacket(data) {
    const payload = data.processed_payload || 
                    data.raw_payload
    const value   = parseFloat(payload[this.fieldValue])

    if (isNaN(value)) return

    const clamped  = Math.min(
      Math.max(value, this.minValue), this.maxValue
    )
    const remainder = this.maxValue - clamped

    this.chart.data.datasets[0].data = [clamped, remainder]
    this.chart.update()

    if (this.hasReadoutTarget) {
      this.readoutTarget.textContent = value.toFixed(1)
    }
  }
}
