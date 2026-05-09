import { Controller } from "@hotwired/stimulus"
import consumer from "channels/consumer"

const TYPE_ICON = {
  value_card:  "fa-hashtag",
  line_chart:  "fa-chart-line",
  gauge:       "fa-gauge-high",
  gps_map:     "fa-map-location-dot",
  attitude_3d: "fa-cube",
  compass:     "fa-compass"
}

export default class extends Controller {
  static targets = ["grid"]

  static values = {
    workspaceId: Number,
    saveUrl:     String,
    editMode:    { type: Boolean, default: true }
  }

  connect() {
    setTimeout(() => this.initGrid(), 50)

    this.element.addEventListener("widget-form:add", this.handleAdd.bind(this))
    this.element.addEventListener("dashboard:remove-widget", this.handleRemove.bind(this))

    if (this.editModeValue === false) {
      this.subscribeToTelemetry()
    }
  }

  disconnect() {
    this.subscription?.unsubscribe()
    this.grid?.destroy(false)
  }

  initGrid() {
    if (!this.hasGridTarget) return

    this.grid = window.GridStack.init({
      column: 12,
      cellHeight: 80,
      margin: 12,
      animate: true,
      float: false,
      disableDrag:   !this.editModeValue,
      disableResize: !this.editModeValue
    }, this.gridTarget)
  }

  subscribeToTelemetry() {
    this.subscription = consumer.subscriptions.create(
      { channel: "WorkspaceTelemetryChannel", workspace_id: this.workspaceIdValue },
      {
        received: (record) => {
          const payload = record.processed_payload && Object.keys(record.processed_payload).length
            ? record.processed_payload
            : record.raw_payload
          window.dispatchEvent(new CustomEvent("telemetry:received", { detail: payload }))
        }
      }
    )
  }

  handleAdd(event) {
    const widget = event.detail.widget
    if (!this.grid) return

    const el = this.buildShellElement(widget)
    this.gridTarget.appendChild(el)
    this.grid.makeWidget(el)
    this.toggleEmptyState()
  }

  handleRemove(event) {
    if (!this.grid) return
    const item = event.target.closest(".grid-stack-item")
    if (!item) return
    this.grid.removeWidget(item)
    this.toggleEmptyState()
  }

  buildShellElement(widget) {
    const el = document.createElement("div")
    el.className = "grid-stack-item designer-widget group"
    el.setAttribute("gs-x", widget.grid.x)
    el.setAttribute("gs-y", widget.grid.y)
    el.setAttribute("gs-w", widget.grid.w)
    el.setAttribute("gs-h", widget.grid.h)
    el.setAttribute("gs-id", widget.id)
    el.dataset.widgetId     = widget.id
    el.dataset.widgetType   = widget.type
    el.dataset.widgetLabel  = widget.label
    el.dataset.widgetConfig = JSON.stringify(widget.config || {})

    const icon   = TYPE_ICON[widget.type] || "fa-shapes"
    const fields = (widget.config?.fields || []).join(", ") || "—"

    el.innerHTML = `
      <div class="grid-stack-item-content designer-widget-card">
        <button class="designer-widget-remove"
                onclick="this.closest('.grid-stack-item').dispatchEvent(new CustomEvent('dashboard:remove-widget', { bubbles: true }))"
                aria-label="Remove widget">
          <i class="fa-solid fa-times"></i>
        </button>
        <div class="designer-widget-grip"><i class="fa-solid fa-grip"></i></div>
        <div class="designer-widget-icon"><i class="fa-solid ${icon}"></i></div>
        <div class="designer-widget-label">${this.escape(widget.label)}</div>
        <div class="designer-widget-fields"><span class="font-mono">${this.escape(fields)}</span></div>
      </div>
    `
    return el
  }

  toggleEmptyState() {
    const empty = this.element.querySelector(".empty-state-overlay")
    if (!empty) return
    const hasWidgets = this.grid.engine.nodes.length > 0
    empty.style.display = hasWidgets ? "none" : "flex"
  }

  saveLayout() {
    if (!this.grid) return

    const layout = this.grid.engine.nodes.map(node => {
      const el = node.el
      return {
        id:     node.id,
        type:   el.dataset.widgetType,
        label:  el.dataset.widgetLabel,
        grid:   { x: node.x, y: node.y, w: node.w, h: node.h },
        config: JSON.parse(el.dataset.widgetConfig || "{}")
      }
    })

    const liveTab = window.open("", "_blank")
    liveTab.document.write("<div style='font-family:sans-serif;padding:2rem'>Saving layout…</div>")

    const activeTheme = this.element.dataset.themeSelection || "blueprint"
    const videoFile   = this.element.canvasThemeVideoFile

    const formData = new FormData()
    formData.append("workspace[dashboard_layout]", JSON.stringify(layout))
    formData.append("workspace[dashboard_theme]", activeTheme)
    if (videoFile) formData.append("workspace[background_video]", videoFile)

    fetch(this.saveUrlValue, {
      method: "PATCH",
      headers: { "X-CSRF-Token": document.querySelector('meta[name="csrf-token"]').content },
      body: formData
    })
      .then(res => {
        if (res.ok) {
          liveTab.location.href = window.location.pathname.replace(/\/edit$/, "") + "/live_dashboard"
        } else {
          liveTab.close()
          console.error("Save layout failed")
        }
      })
      .catch(err => {
        liveTab.close()
        console.error("Save layout failed:", err)
      })
  }

  escape(str) {
    return String(str).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]))
  }
}
