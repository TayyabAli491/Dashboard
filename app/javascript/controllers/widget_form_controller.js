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

  connect() {
    console.log("WidgetFormController connected to:", this.element)
  }

  selectType(event) {
    const type = event.params.type
    console.log("selectType:", type)

    // Auto-fill label
    const label = type.replace(/([A-Z])/g, " $1").trim()

    // For fixed-field widgets, auto-add to dashboard immediately
    if (this.requiredFields[type]) {
      console.log("Auto-adding fixed-field widget:", type)
      this._dispatchWidget(type, label, this.selectedColorValue, this.requiredFields[type])
      return
    }

    // For other widgets, show the config form
    this.typeInputTarget.value = type
    this.labelInputTarget.value = label

    const form = document.getElementById("widget-config-form")
    form.classList.remove("hidden")
    form.classList.add("flex")
  }

  selectColor(event) {
    this.selectedColorValue = event.params.color
    this.element
      .querySelectorAll("[data-widget-form-color-param]")
      .forEach(btn => {
        const isSelected =
          btn.dataset.widgetFormColorParam === this.selectedColorValue
        btn.style.borderColor = isSelected ? "white" : "transparent"
      })
  }

  addWidget({ detail: { widget } }) {
    const grid = this.gridTarget.gridstack
    const gridEl = this.gridTarget
    if (!grid) return
  
    const el = document.createElement("div")
    el.className = "grid-stack-item"
    el.setAttribute("gs-x",  widget.grid.x)
    el.setAttribute("gs-y",  widget.grid.y)
    el.setAttribute("gs-w",  widget.grid.w)
    el.setAttribute("gs-h",  widget.grid.h)
    el.setAttribute("gs-id", widget.id)
    el.dataset.widgetId = widget.id
  
    const dragVisible = this.editModeValue ? "" : "hidden"
  
    el.innerHTML = `
      <div class="grid-stack-item-content">
        <div class="card h-full flex flex-col gap-2 relative overflow-hidden">
          <div class="widget-drag-handle edit-mode-only
                      absolute top-2 right-8
                      cursor-grab text-lg select-none
                      ${dragVisible}"
               style="color:#9E9891; z-index:10;">
            ⠿
          </div>
          <button class="edit-mode-only ${dragVisible}
                         absolute top-2 right-2
                         text-sm leading-none"
                  style="color:#A32D2D; z-index:10;"
                  onclick="this.closest('[data-widget-id]')
                    .dispatchEvent(new CustomEvent(
                      'dashboard:remove-widget',
                      { bubbles: true }
                    ))">
            ✕
          </button>
          <p class="section-label pt-1 px-2">
            ${widget.label}
          </p>
          <div class="flex-1 flex items-center
                      justify-center text-sm"
               style="color:#9E9891;">
            ${widget.type}
          </div>
        </div>
      </div>`
  
    // Add to DOM first so GridStack can initialize drag on it
    gridEl.appendChild(el)           // ← ADD: append before makeWidget
    grid.makeWidget(el)
  
    if (this.editModeValue) {
      grid.enableMove(true)
      grid.enableResize(true)
      // Force GridStack to re-scan and enable the new item specifically
      grid.movable(el, true)         // ← ADD THIS
      grid.resizable(el, true)       // ← ADD THIS
    }
  
    this.saveLayout()
  }


  // ---- private ----

  _dispatchWidget(type, label, color, fields) {
    const widget = {
      id: `widget_${Date.now()}`,
      type: type,
      label: label,
      color: color || "primary",
      fields: fields,
      grid: { x: 0, y: 0, w: 4, h: 4 }
    }

    console.log("Dispatching widget-form:add", widget)

    this.dispatch("add", {
      detail: { widget },
      bubbles: true
    })
  }
}
