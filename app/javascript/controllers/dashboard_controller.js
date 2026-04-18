import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["grid", "editBar", "addWidgetPanel"]

  static values = {
    workspaceId: Number,
    saveUrl:     String,
    editMode:    { type: Boolean, default: false }
  }

  connect() {
    setTimeout(() => this.initGrid(), 50)
    this.element.addEventListener(
      "widget-form:add",
      (e) => this.addWidget(e)
    )
    this.element.addEventListener(
      "dashboard:remove-widget",
      (e) => this.removeWidget(e)
    )
  }

  initGrid() {
    const gridEl = this.gridTarget

    this.grid = window.GridStack.init({
      column:      12,
      cellHeight:  80,
      margin:      8,
      animate:     true,
      draggable:   { handle: ".widget-drag-handle", scroll: false },
      resizable:   { handles: "se" },
      staticGrid:  true,
      float:       false
    }, gridEl)

    console.log("GridStack initialized:", gridEl.gridstack)

    this.grid.on("change", () => {
      if (this.editModeValue) this.saveLayout()
    })
  }

  disconnect() {
    this.grid?.destroy(false)
  }

  toggleEditMode() {
    this.editModeValue = !this.editModeValue

    // Access gridstack directly from DOM element
    // this.grid reference can lose sync after Turbo navigation
    const grid = this.gridTarget.gridstack

    if (!grid) {
      console.error("GridStack not found on grid target")
      return
    }

    if (this.editModeValue) {
      grid.setStatic(false)
      this.editBarTarget.classList.remove("hidden")
      this.editBarTarget.classList.add("flex")
      this.gridTarget
        .querySelectorAll(".edit-mode-only")
        .forEach(el => el.classList.remove("hidden"))
    } else {
      grid.setStatic(true)
      this.editBarTarget.classList.add("hidden")
      this.editBarTarget.classList.remove("flex")
      this.gridTarget
        .querySelectorAll(".edit-mode-only")
        .forEach(el => el.classList.add("hidden"))
      this.saveLayout()
    }
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
    const grid = this.gridTarget.gridstack
    if (!grid) return

    const layout = grid.save(false)

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
    }).catch(err => console.error("Save layout failed:", err))
  }

  addWidget({ detail: { widget } }) {
    const grid = this.gridTarget.gridstack
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

    grid.makeWidget(el)
    this.saveLayout()
  }

  removeWidget(event) {
    const grid = this.gridTarget.gridstack
    if (!grid) return

    const item = event.target.closest("[data-widget-id]")
    if (!item) return

    grid.removeWidget(item)
    this.saveLayout()
  }
}
