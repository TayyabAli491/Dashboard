import { Controller } from "@hotwired/stimulus"
import { GridStack } from "gridstack"

export default class extends Controller {
  static targets = [
    "grid",
    "editBar",
    "addWidgetPanel"
  ]

  static values = {
    workspaceId: Number,
    saveUrl: String,
    editMode: { type: Boolean, default: false }
  }

  connect() {
    this.grid = GridStack.init({
      column: 12,
      cellHeight: 80,
      margin: 12,
      animate: true,
      draggable: { handle: ".widget-drag-handle" },
      resizable: { handles: "se" },
      staticGrid: true
    }, this.gridTarget)

    this.grid.on("change", () => {
      if (this.editModeValue) this.saveLayout()
    })
  }

  disconnect() {
    this.grid?.destroy(false)
  }

  toggleEditMode() {
    this.editModeValue = !this.editModeValue
    this.grid.setStatic(!this.editModeValue)
    this.editBarTarget.classList.toggle(
      "hidden", !this.editModeValue
    )
  }

  openWidgetPanel() {
    this.addWidgetPanelTarget.classList.remove("hidden")
    this.addWidgetPanelTarget.classList.add("flex")
  }

  closeWidgetPanel() {
    this.addWidgetPanelTarget.classList.add("hidden")
    this.addWidgetPanelTarget.classList.remove("flex")
  }

  saveLayout() {
    const layout = this.grid.save(false)
    fetch(this.saveUrlValue, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": document
          .querySelector('meta[name="csrf-token"]')
          .getAttribute("content")
      },
      body: JSON.stringify({
        workspace: { dashboard_layout: layout }
      })
    })
  }
}
