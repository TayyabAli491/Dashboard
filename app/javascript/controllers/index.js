import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
import AutoRefreshController from "controllers/auto_refresh_controller"
import DashboardController from "controllers/dashboard_controller"

unlessAutoRefreshRegistered()
unlessDashboardRegistered()

eagerLoadControllersFrom("controllers", application)

function unlessAutoRefreshRegistered() {
  if (application.router.modulesByIdentifier.has("auto-refresh")) return

  application.register("auto-refresh", AutoRefreshController)
}

function unlessDashboardRegistered() {
  if (application.router.modulesByIdentifier.has("dashboard")) return

  application.register("dashboard", DashboardController)
}
