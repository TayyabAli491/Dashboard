import { application } from "controllers/application"
import { eagerLoadControllersFrom } from "@hotwired/stimulus-loading"
import AutoRefreshController from "controllers/auto_refresh_controller"
import DashboardController from "controllers/dashboard_controller"
import WidgetFormController from "controllers/widget_form_controller"
import ValueCardController from "controllers/value_card_controller"
import LineChartController from "controllers/line_chart_controller"
import GaugeChartController from "controllers/gauge_chart_controller"
import GpsMapController from "controllers/gps_map_controller"
import Attitude3dController from "controllers/attitude_3d_controller"

unlessAutoRefreshRegistered()
unlessDashboardRegistered()
unlessWidgetFormRegistered()
unlessValueCardRegistered()
unlessLineChartRegistered()
unlessGaugeChartRegistered()
unlessGpsMapRegistered()
unlessAttitude3dRegistered()

eagerLoadControllersFrom("controllers", application)

function unlessAutoRefreshRegistered() {
  if (application.router.modulesByIdentifier.has("auto-refresh")) return

  application.register("auto-refresh", AutoRefreshController)
}

function unlessDashboardRegistered() {
  if (application.router.modulesByIdentifier.has("dashboard")) return

  application.register("dashboard", DashboardController)
}

function unlessWidgetFormRegistered() {
  if (application.router.modulesByIdentifier.has("widget-form")) return

  application.register("widget-form", WidgetFormController)
}

function unlessValueCardRegistered() {
  if (application.router.modulesByIdentifier.has("value-card")) return

  application.register("value-card", ValueCardController)
}

function unlessLineChartRegistered() {
  if (application.router.modulesByIdentifier.has("line-chart")) return

  application.register("line-chart", LineChartController)
}

function unlessGaugeChartRegistered() {
  if (application.router.modulesByIdentifier.has("gauge-chart")) return

  application.register("gauge-chart", GaugeChartController)
}

function unlessGpsMapRegistered() {
  if (application.router.modulesByIdentifier.has("gps-map")) return

  application.register("gps-map", GpsMapController)
}

function unlessAttitude3dRegistered() {
  if (application.router.modulesByIdentifier.has("attitude-3d")) return

  application.register("attitude-3d", Attitude3dController)
}
