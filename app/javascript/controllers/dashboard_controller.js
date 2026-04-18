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
    
    // Listen for events
    this.element.addEventListener("widget-form:add", this.addWidget.bind(this))
    this.element.addEventListener("dashboard:remove-widget", this.removeWidget.bind(this))
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
    el.className = "grid-stack-item group"
    el.setAttribute("gs-x", widget.grid.x)
    el.setAttribute("gs-y", widget.grid.y)
    el.setAttribute("gs-w", widget.grid.w)
    el.setAttribute("gs-h", widget.grid.h)
    
    // Premium raw widget design matching the new UI with remove button
    el.innerHTML = `
      <div class="grid-stack-item-content p-4 flex flex-col justify-center items-center bg-white border border-[#E8E4DD] rounded-xl overflow-hidden cursor-move transition-all hover:shadow-[0_8px_20px_rgba(26,26,26,0.06)] hover:border-[#C8C3BB]">
        <button class="absolute top-2 left-2 w-6 h-6 rounded flex items-center justify-center text-[#B5B0A8] hover:bg-[#FCEBEB] hover:text-[#A32D2D] opacity-0 group-hover:opacity-100 transition-all cursor-pointer z-10"
                onclick="this.closest('.grid-stack-item').dispatchEvent(new CustomEvent('dashboard:remove-widget', { bubbles: true }))">
          <i class="fa-solid fa-times text-xs"></i>
        </button>
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
    if (emptyState) {
      emptyState.style.opacity = '0'
      // Option: hide after fade
      setTimeout(() => emptyState.style.display = 'none', 300)
    }

    this.gridTarget.appendChild(el)
    this.grid.makeWidget(el)
  }

  removeWidget(event) {
    if (!this.grid) return

    const item = event.target.closest(".grid-stack-item")
    if (!item) return

    this.grid.removeWidget(item)
    
    // Check if empty and restore empty state
    if (this.grid.engine.nodes.length === 0) {
      const emptyState = this.element.querySelector('.absolute.inset-0')
      if (emptyState) {
        emptyState.style.display = 'flex'
        setTimeout(() => emptyState.style.opacity = '1', 50)
      }
    }
  }

  disconnect() {
    if (this.grid) this.grid.destroy(false)
  }
}
