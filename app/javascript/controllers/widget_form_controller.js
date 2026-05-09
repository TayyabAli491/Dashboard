import { Controller } from "@hotwired/stimulus"

const COLOR_MAP = {
  primary: "#6366F1",
  cyan:    "#06B6D4",
  success: "#10B981",
  warning: "#F59E0B",
  danger:  "#EF4444"
}

export default class extends Controller {
  static values = {
    schemaFields: Array,
    catalog:      Object,
    colors:       Array
  }

  // We only declare the modal target here so Stimulus can locate it on connect.
  // All other elements inside the modal are cached by ref in connect() because
  // after the portal move (appendTo body) they leave the controller's subtree.
  static targets = ["modal"]

  connect() {
    this.activeType    = null
    this.activeSpec    = null
    this.selectedColor = "primary"
    this.numericFields = this.schemaFieldsValue.filter(f =>
      ["float", "integer", "numeric"].includes(f.type)
    )

    // Cache all inner-modal element references BEFORE the portal move.
    // We query by data-widget-form-target because Stimulus still finds them here.
    this._m = {
      backdrop:        this.modalTarget,
      title:           this._q("title"),
      icon:            this._q("icon"),
      labelInput:      this._q("labelInput"),
      fieldsRow:       this._q("fieldsRow"),
      fieldsHint:      this._q("fieldsHint"),
      fieldsContainer: this._q("fieldsContainer"),
      autoFieldsRow:   this._q("autoFieldsRow"),
      autoFields:      this._q("autoFields"),
      colorRow:        this._q("colorRow"),
      colorPicker:     this._q("colorPicker"),
      unitRow:         this._q("unitRow"),
      unitInput:       this._q("unitInput"),
      decimalsRow:     this._q("decimalsRow"),
      decimalsInput:   this._q("decimalsInput"),
      minRow:          this._q("minRow"),
      minInput:        this._q("minInput"),
      maxRow:          this._q("maxRow"),
      maxInput:        this._q("maxInput"),
      error:           this._q("error")
    }

    // Portal: move modal to <body> so position:fixed is always viewport-relative,
    // unaffected by ancestor overflow:hidden / overflow:auto or transforms.
    document.body.appendChild(this._m.backdrop)

    // Wire up modal buttons manually (data-action won't route outside controller element).
    this._m.backdrop.addEventListener("click", this._onBackdrop.bind(this))
    this._m.backdrop.querySelectorAll("[data-close-modal]").forEach(el =>
      el.addEventListener("click", this.closeConfig.bind(this))
    )
    this._m.backdrop.querySelector("[data-submit-modal]")
      ?.addEventListener("click", this.submit.bind(this))
  }

  disconnect() {
    // Return modal to controller element so it's available if the controller reconnects.
    if (this._m?.backdrop && this._m.backdrop.parentElement === document.body) {
      this.element.appendChild(this._m.backdrop)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  _q(target) {
    return this.element.querySelector(`[data-widget-form-target="${target}"]`)
      || document.querySelector(`[data-widget-form-target="${target}"]`)
  }

  _onBackdrop(event) {
    if (event.target === this._m.backdrop) this.closeConfig()
  }

  // ── Open / close ───────────────────────────────────────────────────────────

  openConfig(event) {
    const type = event.currentTarget.dataset.widgetType
    const spec = this.catalogValue[type]
    if (!spec) return

    this.activeType    = type
    this.activeSpec    = spec
    this.selectedColor = "primary"

    this._m.title.textContent    = spec.label
    this._m.icon.innerHTML       = `<i class="fa-solid ${spec.icon}"></i>`
    this._m.labelInput.value     = spec.label
    this._m.error.classList.add("hidden")

    this.renderColorPicker()
    this.toggleConfigSections(spec)

    if (spec.min_fields > 0) {
      this.renderFieldSelectors(spec)
    } else if (spec.auto_fields) {
      this.renderAutoFields(spec)
    }

    this._m.backdrop.classList.remove("hidden")
    document.body.style.overflow = "hidden"
  }

  closeConfig() {
    this._m.backdrop.classList.add("hidden")
    document.body.style.overflow = ""
  }

  // ── Rendering helpers ──────────────────────────────────────────────────────

  toggleConfigSections(spec) {
    const cfg = spec.configurable || []
    this._m.fieldsRow.hidden     = !cfg.includes("fields")
    this._m.autoFieldsRow.hidden = !spec.auto_fields
    this._m.colorRow.hidden      = !cfg.includes("color")
    this._m.unitRow.hidden       = !cfg.includes("unit")
    this._m.decimalsRow.hidden   = !cfg.includes("decimals")
    this._m.minRow.hidden        = !cfg.includes("min")
    this._m.maxRow.hidden        = !cfg.includes("max")
  }

  renderFieldSelectors(spec) {
    const container = this._m.fieldsContainer
    container.innerHTML = ""

    this._m.fieldsHint.textContent = spec.max_fields === 1
      ? " (1 field)"
      : ` (up to ${spec.max_fields})`

    if (this.numericFields.length === 0) {
      container.innerHTML = `<div class="widget-config-empty">No numeric fields in your schema. Add some via the schema editor.</div>`
      return
    }

    for (let i = 0; i < spec.max_fields; i++) {
      const select = document.createElement("select")
      select.className = "widget-config-input"
      select.dataset.fieldSlot = i

      const placeholder = document.createElement("option")
      placeholder.value = ""
      placeholder.textContent = i === 0 ? "Select field…" : "Add another field (optional)…"
      select.appendChild(placeholder)

      this.numericFields.forEach(f => {
        const opt = document.createElement("option")
        opt.value = f.key
        opt.textContent = `${f.key}${f.alias ? ` — ${f.alias}` : ""}${f.unit ? ` (${f.unit})` : ""}`
        select.appendChild(opt)
      })

      container.appendChild(select)
    }
  }

  renderAutoFields(spec) {
    const known   = this.schemaFieldsValue.map(f => f.key)
    const aliases = spec.auto_aliases || {}

    this._m.autoFields.innerHTML = spec.auto_fields.map(name => {
      const variants = [name, ...(aliases[name] || [])]
      const present  = variants.find(v => known.includes(v))
      const display  = present || `${name} (missing — add to schema)`
      return `
        <div class="widget-config-auto-row ${present ? "ok" : "miss"}">
          <i class="fa-solid ${present ? "fa-check" : "fa-triangle-exclamation"}"></i>
          <span class="font-mono text-[12px]">${display}</span>
        </div>`
    }).join("")
  }

  renderColorPicker() {
    this._m.colorPicker.innerHTML = this.colorsValue.map(c => `
      <button type="button"
              class="widget-config-swatch ${c === this.selectedColor ? "selected" : ""}"
              data-color="${c}"
              style="background:${COLOR_MAP[c] || "#6366F1"}"
              title="${c}"></button>
    `).join("")

    this._m.colorPicker.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        this.selectedColor = btn.dataset.color
        this._m.colorPicker.querySelectorAll("button").forEach(b => b.classList.remove("selected"))
        btn.classList.add("selected")
      })
    })
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  collectFields() {
    if (this.activeSpec.min_fields === 0) return this.activeSpec.auto_fields || []
    return Array.from(this._m.fieldsContainer.querySelectorAll("select"))
      .map(s => s.value).filter(v => v.length > 0)
  }

  submit() {
    const fields = this.collectFields()

    if (this.activeSpec.min_fields > 0 && fields.length < this.activeSpec.min_fields) {
      const n = this.activeSpec.min_fields
      return this.showError(`Please select at least ${n} field${n > 1 ? "s" : ""}.`)
    }

    const config = {
      fields,
      color:    this._m.colorRow.hidden    ? "primary" : this.selectedColor,
      unit:     this._m.unitRow.hidden     ? ""        : this._m.unitInput.value.trim(),
      decimals: this._m.decimalsRow.hidden ? 1         : parseInt(this._m.decimalsInput.value, 10) || 0,
      min:      this._m.minRow.hidden      ? 0         : parseFloat(this._m.minInput.value) || 0,
      max:      this._m.maxRow.hidden      ? 100       : parseFloat(this._m.maxInput.value) || 100
    }

    const widget = {
      id:    `widget_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type:  this.activeType,
      label: this._m.labelInput.value.trim() || this.activeSpec.label,
      grid:  { x: 0, y: 0, ...this.activeSpec.default_grid },
      config
    }

    this.dispatch("add", { detail: { widget }, prefix: "widget-form" })
    this.closeConfig()
  }

  showError(msg) {
    this._m.error.textContent = msg
    this._m.error.classList.remove("hidden")
  }
}
