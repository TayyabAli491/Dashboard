import { Controller } from "@hotwired/stimulus"
import * as L from "leaflet"

const COLOR_HEX = {
  primary: "#6366F1",
  cyan:    "#06B6D4",
  success: "#10B981",
  warning: "#F59E0B",
  danger:  "#EF4444"
}

export default class extends Controller {
  static values = {
    latField: { type: String, default: "latitude" },
    lngField: { type: String, default: "longitude" },
    color:    { type: String, default: "primary" },
    follow:   { type: Boolean, default: true }
  }

  connect() {
    this.path = []
    this.accent = COLOR_HEX[this.colorValue] || COLOR_HEX.primary

    this.map = L.map(this.element, {
      center: [0, 0],
      zoom: 2,
      zoomControl: true,
      attributionControl: false
    })

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    ).addTo(this.map)

    this.marker = L.circleMarker([0, 0], {
      radius: 7,
      fillColor: this.accent,
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(this.map)

    this.trail = L.polyline([], {
      color: this.accent,
      weight: 2,
      opacity: 0.7
    }).addTo(this.map)

    this.firstFix = false
    this.handleTelemetry = this.handleTelemetry.bind(this)
    window.addEventListener("telemetry:received", this.handleTelemetry)
  }

  disconnect() {
    this.map?.remove()
    window.removeEventListener("telemetry:received", this.handleTelemetry)
  }

  handleTelemetry(event) {
    const payload = event.detail
    if (!payload) return

    const lat = parseFloat(payload[this.latFieldValue] ?? payload.latitude ?? payload.lat)
    const lng = parseFloat(payload[this.lngFieldValue] ?? payload.longitude ?? payload.lng ?? payload.lon)
    if (isNaN(lat) || isNaN(lng)) return

    const position = [lat, lng]
    this.marker.setLatLng(position)
    this.path.push(position)
    this.trail.setLatLngs(this.path)

    if (!this.firstFix) {
      this.map.setView(position, 17)
      this.firstFix = true
    } else if (this.followValue) {
      this.map.panTo(position)
    }
  }
}
