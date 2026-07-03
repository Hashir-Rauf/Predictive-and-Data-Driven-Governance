import { Hono } from "hono";
import { cors } from "hono/cors";
import { fail, ok } from "./lib/response";
import { requestLogger } from "./middleware/requestLogger";
import { securityHeaders } from "./middleware/securityHeaders";
import { adminRoutes } from "./routes/admin.routes";
import { agenciesRoutes } from "./routes/agencies.routes";
import { anomaliesRoutes } from "./routes/anomalies.routes";
import { authRoutes } from "./routes/auth.routes";
import { computeJobsRoutes, forecastsRoutes } from "./routes/forecasts.routes";
import { complaintsRoutes, metricsRoutes } from "./routes/metrics.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { narrativeRoutes } from "./routes/narrative.routes";
import { regionsRoutes } from "./routes/regions.routes";
import type { AppEnv } from "./middleware/auth";

export const app = new Hono<AppEnv>();

app.use("*", securityHeaders);
app.use("*", requestLogger);
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => (origin === c.env.ALLOWED_ORIGIN ? origin : ""),
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE"],
  })
);

app.get("/api/health", (c) => ok(c, { status: "ok", environment: c.env.ENVIRONMENT }));

app.route("/api/auth", authRoutes);
app.route("/api/regions", regionsRoutes);
app.route("/api/agencies", agenciesRoutes);
app.route("/api/metrics", metricsRoutes);
app.route("/api/complaints", complaintsRoutes);
app.route("/api/forecasts", forecastsRoutes);
app.route("/api/compute-jobs", computeJobsRoutes);
app.route("/api/anomalies", anomaliesRoutes);
app.route("/api/narrative", narrativeRoutes);
app.route("/api/dashboard", dashboardRoutes);
app.route("/api/admin", adminRoutes);

app.notFound((c) => fail(c, "not_found", "No such route", 404));
app.onError((err, c) => {
  console.error(JSON.stringify({ event: "unhandled_error", message: String(err) }));
  return fail(c, "internal_error", "Something went wrong", 500);
});
