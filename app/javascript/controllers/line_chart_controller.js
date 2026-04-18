import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"
const COLOR_MAP = {
  primary: { line: "#6366F1", fill: "rgba(99,102,241,0.08)" },
  cyan: { line: "#06B6D4", fill: "rgba(6,182,212,0.06)" },
  success: { line: "#10B981", fill: "rgba(16,185,129,0.06)" },
  warning: { line: "#F59E0B", fill: "rgba(245,158,11,0.06)" },
  danger: { line: "#EF4444", fill: "rgba(239,68,68,0.06)" }
}

const MAX_POINTS = 60
const Chart = window.Chart

export default class extends Controller {
  static values = {
    fields:      Array,
    workspaceId: Number,
    color:       String
  }
  
  connect() {
    this.chart = new Chart(this.element, {
      type: "line",
      data: {
        labels: [],
        datasets: this.fieldsValue.map((field, i) => {
          const colors = Object.values(COLOR_MAP)
          const c = colors[i % colors.length]
          return {
            label: field,
            data: [],
            borderColor: c.line,
            backgroundColor: c.fill,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            borderWidth: 2
          }
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 300 },
        scales: {
          x: {
            ticks: { color: "#475569", maxTicksLimit: 6 },
            grid: { color: "rgba(255,255,255,0.04)" }
          },
          y: {
            ticks: { color: "#475569" },
            grid: { color: "rgba(255,255,255,0.04)" }
          }
        },
        plugins: {
          legend: {
            labels: { color: "#94A3B8", boxWidth: 12 }
          }
        }
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
    const payload   = data.processed_payload || 
                      data.raw_payload
    const timestamp = new Date(
      data.recorded_at
    ).toLocaleTimeString()

    if (this.chart.data.labels.length >= MAX_POINTS) {
      this.chart.data.labels.shift()
      this.chart.data.datasets
        .forEach(ds => ds.data.shift())
    }

    this.chart.data.labels.push(timestamp)

    this.fieldsValue.forEach((field, i) => {
      const value = payload[field]
      this.chart.data.datasets[i].data.push(
        value !== undefined ? parseFloat(value) : null
      )
    })

    this.chart.update("none")
  }
}
