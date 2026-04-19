import { Controller } from "@hotwired/stimulus"
import * as L from "leaflet"

export default class extends Controller {
  static values = {
    workspaceId: Number,
    follow:      { type: Boolean, default: true }
  }

  connect() {
    this.pathCoordinates = []

    this.map = L.map(this.element, {
      center: [31.463888, 74.442777],
      zoom: 17,
      zoomControl: true,
      attributionControl: false
    })

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      { maxZoom: 19 }
    ).addTo(this.map)

    this.marker = L.circleMarker([31.463888, 74.442777], {
      radius: 8,
      fillColor: "#6366F1",
      color: "#fff",
      weight: 2,
      opacity: 1,
      fillOpacity: 1
    }).addTo(this.map)

    this.path = L.polyline([], {
      color: "#6366F1",
      weight: 2,
      opacity: 0.6
    }).addTo(this.map)

    this.handleTelemetry = this.handleTelemetry.bind(this)
    window.addEventListener("telemetry:received", this.handleTelemetry)
  }

  disconnect() {
    this.map?.remove()
    window.removeEventListener("telemetry:received", this.handleTelemetry)
  }

  handleTelemetry(event) {
    // Reconstruct the expected object wrapper to keep identical logic
    const data = { raw_payload: event.detail }
    const payload = data.processed_payload || 
                    data.raw_payload

    const lat = parseFloat(payload.latitude  || payload.lat)
    const lng = parseFloat(payload.longitude || payload.lon)

    if (isNaN(lat) || isNaN(lng)) return

    const position = [lat, lng]

    this.marker.setLatLng(position)
    this.pathCoordinates.push(position)
    this.path.setLatLngs(this.pathCoordinates)

    if (this.followValue) {
      this.map.panTo(position)
    }
  }
}
