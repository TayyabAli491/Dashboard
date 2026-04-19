import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["tab", "panel"]

  connect() {
    // If the URL has a hash matching a panel ID, show that tab
    const hash = window.location.hash
    if (hash) {
      const panel = this.panelTargets.find(el => el.id === hash.replace("#", ""))
      if (panel) {
        const index = this.panelTargets.indexOf(panel)
        if (index >= 0) return this.showTab(index)
      }
    }
    
    // Default to first tab
    this.showTab(0)
  }

  select(event) {
    event.preventDefault()
    let index = this.tabTargets.indexOf(event.currentTarget)
    this.showTab(index)
  }

  showTab(index) {
    this.tabTargets.forEach((el, i) => {
      if (i === index) {
        el.setAttribute("aria-selected", "true")
      } else {
        el.setAttribute("aria-selected", "false")
      }
    })
    
    this.panelTargets.forEach((el, i) => {
      if (i === index) {
        el.classList.remove("hidden")
        el.classList.add("block")
      } else {
        el.classList.add("hidden")
        el.classList.remove("block")
      }
    })
  }
}
