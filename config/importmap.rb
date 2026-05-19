pin "application"
pin "@rails/actioncable",
  to: "https://cdn.jsdelivr.net/npm/@rails/actioncable@8.1.300/app/assets/javascripts/actioncable.esm.js"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"
pin_all_from "app/javascript/channels", under: "channels"

pin "@kurkle/color",
  to: "https://cdn.jsdelivr.net/npm/@kurkle/color@0.3.2/dist/color.esm.js"

pin "leaflet",
  to: "https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet-src.esm.js"

pin "three",
  to: "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
