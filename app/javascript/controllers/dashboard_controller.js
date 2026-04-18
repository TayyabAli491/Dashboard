import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["grid"]

  static values = {
    workspaceId: Number,
    editMode: { type: Boolean, default: true }
  }

  connect() {
    console.log("Dashboard Controller initialized. Setting up GridStack...")
    setTimeout(() => this.initGrid(), 50)
    
    // Listen for "add" events bubbling up from the widget form
    this.element.addEventListener("widget-form:add", this.addWidget.bind(this))
  }

  initGrid() {
    if (!this.hasGridTarget) return

    this.grid = window.GridStack.init({
      column: 12,
      cellHeight: 80,
      margin: 12,
      animate: true,
      float: false,
      disableDrag: !this.editModeValue,
      disableResize: !this.editModeValue
    }, this.gridTarget)

    console.log("GridStack ready!")
  }

  addWidget(event) {
    const widget = event.detail.widget
    if (!this.grid) return

    const el = document.createElement("div")
    el.className = "grid-stack-item"
    el.setAttribute("gs-x", widget.grid.x)
    el.setAttribute("gs-y", widget.grid.y)
    el.setAttribute("gs-w", widget.grid.w)
    el.setAttribute("gs-h", widget.grid.h)
    
    // Premium raw widget design matching the new UI
    el.innerHTML = `
      <div class="grid-stack-item-content p-4 flex flex-col justify-center items-center bg-white border border-[#E8E4DD] rounded-xl overflow-hidden cursor-move transition-all hover:shadow-[0_8px_20px_rgba(26,26,26,0.06)] hover:border-[#C8C3BB]">
        <div class="absolute top-3 right-3 text-[#B5B0A8] text-[10px]">
          <i class="fa-solid fa-grip"></i>
        </div>
        <div class="w-10 h-10 rounded-full bg-[#F7F5F1] flex items-center justify-center mb-3 text-[#1A1A1A]">
          <i class="fa-solid fa-shapes text-sm"></i>
        </div>
        <div class="font-semibold text-sm text-[#1A1A1A]">${widget.label}</div>
        <div class="text-[9px] font-semibold text-[#9E9891] uppercase tracking-widest mt-1">Draggable</div>
      </div>
    `
    
    // Fade out the empty state overlay
    const emptyState = this.element.querySelector('.absolute.inset-0')
    if (emptyState) emptyState.style.opacity = '0'

    this.gridTarget.appendChild(el)
    this.grid.makeWidget(el)
  }

  disconnect() {
    if (this.grid) this.grid.destroy(false)
  }
}
