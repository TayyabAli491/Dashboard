import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = [
    "typeInput",
    "labelInput",
    "fieldSelect",
    "fieldSelectors"
  ]

  static values = {
    workspaceId: Number,
    selectedColor: { type: String, default: "primary" }
  }

  // Widget types that need multiple fields
  multiFieldTypes = ["LineChart", "BarChart"]

  // Widget types and their required fields
  requiredFields = {
    GPSMap: ["latitude", "longitude", "altitude"],
    Attitude3D: ["pitch", "roll", "yaw"],
    Compass3D: ["heading"],
    AltitudeBar: ["altitude"]
  }

  selectType(event) {
    const type = event.params.type
    this.typeInputTarget.value = type

    const form = document.getElementById(
      "widget-config-form"
    )
    form.classList.remove("hidden")
    form.classList.add("flex")

    // Auto-fill label
    this.labelInputTarget.value = type
      .replace(/([A-Z])/g, " $1")
      .trim()

    // Handle fixed-field widgets
    if (this.requiredFields[type]) {
      this.fieldSelectorsTarget.innerHTML =
        `<p class="text-text-muted text-sm">
          Uses: ${this.requiredFields[type].join(", ")}
        </p>`
    }
  }

  selectColor(event) {
    this.selectedColorValue = event.params.color
    // Update active state on color buttons
    this.element
      .querySelectorAll("[data-widget-form-color-param]")
      .forEach(btn => {
        const isSelected =
          btn.dataset.widgetFormColorParam ===
          this.selectedColorValue
        btn.style.borderColor = isSelected ?
          "white" : "transparent"
      })
  }

  addWidget() {
    const type = this.typeInputTarget.value
    const label = this.labelInputTarget.value
    const color = this.selectedColorValue

    if (!type || !label) return

    let fields = []

    if (this.requiredFields[type]) {
      fields = this.requiredFields[type]
    } else {
      fields = Array.from(
        this.fieldSelectorsTarget
          .querySelectorAll("select")
      ).map(s => s.value).filter(Boolean)
    }

    const widget = {
      id: `widget_${Date.now()}`,
      type: type,
      label: label,
      color: color,
      fields: fields,
      grid: { x: 0, y: 0, w: 4, h: 4 }
    }

    // Dispatch to dashboard controller
    this.dispatch("add", {
      detail: { widget },
      bubbles: true
    })

    // Reset form
    this.labelInputTarget.value = ""
    this.typeInputTarget.value = ""
    document
      .getElementById("widget-config-form")
      .classList.add("hidden")
  }
}
