import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  addTestWidget(event) {
    const type = event.currentTarget.dataset.widgetType || "Value Card"
    console.log("Adding raw widget:", type)

    const widget = {
      id: `widget_${Date.now()}`,
      type: type,
      label: type,
      grid: { x: 0, y: 0, w: 4, h: 4 }
    }

    this.dispatch("add", { detail: { widget }, bubbles: true })
  }
}
