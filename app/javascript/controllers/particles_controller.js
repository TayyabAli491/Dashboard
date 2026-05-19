import { Controller } from "@hotwired/stimulus"

let particlesEnginePromise

async function loadParticlesEngine() {
  if (particlesEnginePromise) return particlesEnginePromise

  particlesEnginePromise = (async () => {
    const [{ tsParticles }, { loadSlim }] = await Promise.all([
      import("https://cdn.jsdelivr.net/npm/tsparticles-engine@2.12.0/+esm"),
      import("https://cdn.jsdelivr.net/npm/tsparticles-slim@2.12.0/+esm")
    ])

    await loadSlim(tsParticles)
    return tsParticles
  })()

  return particlesEnginePromise
}

export default class extends Controller {
  static values = {
    id: String
  }

  async connect() {
    this.containerId = this.idValue || this.element.id
    if (!this.containerId) return

    this.tsParticles = await loadParticlesEngine()

    this.destroyExistingContainer()
    this.container = await this.tsParticles.load(this.containerId, this.particleOptions)
  }

  disconnect() {
    if (this.container) {
      this.container.destroy()
      this.container = null
    }
  }

  destroyExistingContainer() {
    const existingContainer = this.tsParticles.dom().find((container) => container.id === this.containerId)
    if (existingContainer) existingContainer.destroy()
  }

  get particleOptions() {
    return {
      fullScreen: { enable: false },
      background: { color: "transparent" },
      fpsLimit: 60,
      interactivity: {
        events: {
          onHover: { enable: true, mode: "grab" },
          resize: true
        },
        modes: {
          grab: { distance: 150, links: { opacity: 0.3 } }
        }
      },
      particles: {
        color: { value: ["#F7F5F1", "#E8E4DD", "#B5B0A8"] },
        links: {
          color: "#F7F5F1",
          distance: 130,
          enable: true,
          opacity: 0.08,
          width: 1
        },
        move: {
          enable: true,
          speed: 0.6,
          direction: "none",
          random: true,
          straight: false,
          outModes: { default: "bounce" }
        },
        number: {
          density: { enable: true, area: 900 },
          value: 70
        },
        opacity: {
          value: { min: 0.15, max: 0.5 },
          animation: {
            enable: true,
            speed: 0.8,
            minimumValue: 0.1,
            sync: false
          }
        },
        shape: { type: "circle" },
        size: {
          value: { min: 1.5, max: 4 },
          animation: {
            enable: true,
            speed: 1.5,
            minimumValue: 1,
            sync: false
          }
        }
      },
      detectRetina: true
    }
  }
}
