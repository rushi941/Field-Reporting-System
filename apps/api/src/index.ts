import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { authRouter } from "./routes/auth.js";
import { usersRouter } from "./routes/users.js";
import { permissionsRouter } from "./routes/permissions.js";
import { crewsRouter } from "./routes/crews.js";
import { fieldProjectsRouter } from "./routes/field-projects.js";
import { fieldReportsRouter } from "./routes/field-reports.js";
import { approvalsRouter } from "./routes/approvals.js";
import { billingRouter } from "./routes/billing.js";
import { projectTypesRouter } from "./routes/project-types.js";
import { unitsRouter } from "./routes/units.js";
import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { errorHandler } from "./middleware/error-handler.js";
import { getUploadRoot } from "./lib/storage.js";
import { mountSwagger } from "./swagger/setup.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

/**
 * Prefer apps/api/public (copied at build). Fall back to monorepo apps/web/dist.
 * Never join process.cwd() + "apps/web/..." (npm -w sets cwd to apps/api).
 */
function resolveWebDist(): string | null {
  const apiSrcDir = path.dirname(fileURLToPath(import.meta.url)); // .../apps/api/src
  const apiRoot = path.resolve(apiSrcDir, ".."); // .../apps/api
  const preferred = path.join(apiRoot, "public");

  const candidates: string[] = [preferred];

  let dir = apiRoot;
  for (let i = 0; i < 5; i++) {
    dir = path.dirname(dir);
    const pkg = path.join(dir, "package.json");
    const webDist = path.join(dir, "apps", "web", "dist");
    if (fs.existsSync(pkg) && fs.existsSync(path.join(webDist, "index.html"))) {
      candidates.push(webDist);
      break;
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }
  return null;
}

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));

/** Local attachment files (STORAGE_DRIVER=local) */
app.use(
  "/uploads",
  express.static(getUploadRoot(), {
    fallthrough: true,
    maxAge: "1d",
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "frs-api" });
});

mountSwagger(app);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", usersRouter);
app.use("/api/v1/permissions", permissionsRouter);
app.use("/api/v1/crews", crewsRouter);
app.use("/api/v1/field/projects", fieldProjectsRouter);
app.use("/api/v1/field/reports", fieldReportsRouter);
app.use("/api/v1/approvals", approvalsRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/project-types", projectTypesRouter);
app.use("/api/v1/units", unitsRouter);
app.use("/api/v1/tasks", tasksRouter);
app.use("/api/v1/projects", projectsRouter);

const webDist = resolveWebDist();
if (webDist) {
  app.use(
    express.static(webDist, {
      index: false,
      fallthrough: true,
      maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
    }),
  );

  app.get("*", (req, res, next) => {
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/uploads") ||
      req.path === "/health"
    ) {
      next();
      return;
    }
    res.sendFile(path.join(webDist, "index.html"), (err) => {
      if (err) next(err);
    });
  });
} else {
  console.warn(
    "Web UI not found. Expected apps/api/public (after build) or apps/web/dist.",
  );
}

app.use(errorHandler);

app.listen(port, () => {
  console.log(`FRS API listening on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/api/docs`);
  console.log(`Uploads dir: ${path.resolve(getUploadRoot())}`);
  if (webDist) console.log(`Web UI: ${webDist}`);
  else console.warn("Web UI: not mounted");
});

export { app };
