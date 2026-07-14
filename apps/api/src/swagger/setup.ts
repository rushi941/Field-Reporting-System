import type { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { openApiSpec, withDefaultSecurity } from "./openapi.js";

const document = withDefaultSecurity(openApiSpec);

/**
 * Swagger UI at /api/docs — Try it out with Authorize (Bearer JWT).
 */
export function mountSwagger(app: Express) {
  app.get("/api/docs.json", (_req, res) => {
    res.json(document);
  });

  app.use(
    "/api/docs",
    (_req, res, next) => {
      // swagger-ui needs inline styles/scripts; loosen CSP for docs only
      res.removeHeader("Content-Security-Policy");
      next();
    },
    swaggerUi.serve,
    swaggerUi.setup(document, {
      customSiteTitle: "FRS API Docs",
      swaggerOptions: {
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
        filter: true,
      },
    }),
  );
}
