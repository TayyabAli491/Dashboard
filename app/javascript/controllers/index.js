import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
import AutoRefreshController from "controllers/auto_refresh_controller"

unlessAutoRefreshRegistered()

eagerLoadControllersFrom("controllers", application)

function unlessAutoRefreshRegistered() {
  if (application.router.modulesByIdentifier.has("auto-refresh")) return

  application.register("auto-refresh", AutoRefreshController)
}
