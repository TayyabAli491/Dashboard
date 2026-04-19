import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["value", "status"]
  static values = { 
    dataKey: String
  }

  update(event) {
    const payload = event.detail
    
    // Attempt to locate the value in the hardware payload based on the widget label (e.g. "altitude")
    const searchKey = this.dataKeyValue.toLowerCase()
    
    if (payload[searchKey] !== undefined) {
      // Securely update DOM elements dynamically bypassing any complex virtual DOM overhead!
      this.valueTarget.textContent = payload[searchKey]
      
      // Update the UI "Awaiting Signal" sequence to indicate active physical connection!
      this.statusTarget.textContent = "[ SIGNAL ACTIVE ]"
      this.statusTarget.classList.remove("text-[#C1440E]", "animate-pulse")
      this.statusTarget.classList.add("text-[#17B876]", "drop-shadow-[0_0_8px_rgba(23,184,118,0.5)]")
      
      // Create a micro-animation flash on the value text for highly professional feedback!
      this.valueTarget.style.color = "#17B876"
      setTimeout(() => {
        this.valueTarget.style.color = "#E5E5E5"
      }, 500)
    }
  }
}
