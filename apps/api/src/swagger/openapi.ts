/**
 * OpenAPI 3.0 spec for FRS API — served at /api/docs
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "FRS Advance Traffic API",
    version: "0.1.0",
    description:
      "Field Reporting System API. Authorize with Bearer JWT from POST /api/v1/auth/login.\n\n" +
      "Seed users (password `ChangeMe123!`): lead@frs.local, manager@frs.local, padmin@frs.local, admin@frs.local",
  },
  servers: [
    { url: "http://localhost:4000", description: "Local API" },
    { url: "http://localhost:5174", description: "Via Vite proxy" },
  ],
  tags: [
    { name: "Health" },
    { name: "Auth" },
    { name: "Field — Projects" },
    { name: "Field — Reports" },
    { name: "Approvals" },
    { name: "Billing" },
    { name: "Projects" },
    { name: "Bid master" },
    { name: "Project types" },
    { name: "Users" },
    { name: "Permissions" },
    { name: "Crews" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Paste the token from /api/v1/auth/login",
      },
    },
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {},
            },
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", example: "lead@frs.local" },
          password: { type: "string", example: "ChangeMe123!" },
        },
      },
      LoginResponse: {
        type: "object",
        properties: {
          token: { type: "string" },
          user: {
            type: "object",
            properties: {
              id: { type: "string" },
              email: { type: "string" },
              firstName: { type: "string" },
              lastName: { type: "string" },
              roles: { type: "array", items: { type: "string" } },
              permissions: { type: "object", additionalProperties: { type: "string" } },
            },
          },
        },
      },
      DraftReportRequest: {
        type: "object",
        required: ["projectId", "reportDate"],
        properties: {
          projectId: { type: "string" },
          reportDate: { type: "string", format: "date", example: "2026-07-14" },
          crewSize: { type: "integer", nullable: true },
          notes: { type: "string", nullable: true },
        },
      },
      StaSegment: {
        type: "object",
        required: ["beginSta", "endSta", "conversionFactor"],
        properties: {
          beginSta: { type: "string", example: "100+00" },
          endSta: { type: "string", example: "105+00" },
          conversionFactor: { type: "number", example: 1.5 },
          useManualLf: { type: "boolean", default: false },
          manualLf: { type: "number", nullable: true },
        },
      },
      LocationSegment: {
        type: "object",
        required: ["locationDescription", "symbolItemType", "quantity"],
        properties: {
          locationDescription: { type: "string", example: "STA 12+50 NB ramp" },
          symbolItemType: { type: "string", example: "Left arrow" },
          quantity: { type: "number", example: 2 },
        },
      },
      SaveTaskLines: {
        type: "object",
        required: ["segments"],
        properties: {
          segments: {
            type: "array",
            items: {
              oneOf: [
                { $ref: "#/components/schemas/StaSegment" },
                { $ref: "#/components/schemas/LocationSegment" },
              ],
            },
          },
        },
      },
      ApproveWithNotes: {
        type: "object",
        required: ["notes"],
        properties: {
          notes: { type: "string", example: "OK with minor variance" },
        },
      },
      ReturnReport: {
        type: "object",
        required: ["comment"],
        properties: {
          comment: { type: "string", example: "Fix End STA" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    service: { type: "string" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/v1/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        security: [],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "JWT + user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LoginResponse" },
              },
            },
          },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/api/v1/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        responses: {
          "200": { description: "User + permissions" },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/api/v1/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout (client clears token)",
        responses: { "200": { description: "OK" } },
      },
    },
    "/api/v1/field/projects": {
      get: {
        tags: ["Field — Projects"],
        summary: "List projects assigned to field lead",
        responses: { "200": { description: "Projects with tasks" } },
      },
    },
    "/api/v1/field/reports": {
      get: {
        tags: ["Field — Reports"],
        summary: "List my reports",
        responses: { "200": { description: "Reports list" } },
      },
    },
    "/api/v1/field/reports/draft": {
      post: {
        tags: ["Field — Reports"],
        summary: "Get or create draft for project + date",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/DraftReportRequest" },
            },
          },
        },
        responses: { "200": { description: "Draft report" } },
      },
    },
    "/api/v1/field/reports/{id}": {
      get: {
        tags: ["Field — Reports"],
        summary: "Report detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Report" } },
      },
      patch: {
        tags: ["Field — Reports"],
        summary: "Update draft/returned header (date, crew, notes)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  reportDate: { type: "string", format: "date" },
                  crewSize: { type: "integer", nullable: true },
                  notes: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Updated report" } },
      },
    },
    "/api/v1/field/reports/{id}/tasks/{projectTaskId}": {
      put: {
        tags: ["Field — Reports"],
        summary: "Save line items for a project task",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          {
            name: "projectTaskId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SaveTaskLines" },
            },
          },
        },
        responses: { "200": { description: "Report with lines" } },
      },
    },
    "/api/v1/field/reports/{id}/submit": {
      post: {
        tags: ["Field — Reports"],
        summary: "Submit (or resubmit) report for approval",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Submitted report" } },
      },
    },
    "/api/v1/field/reports/{id}/attachments": {
      post: {
        tags: ["Field — Reports"],
        summary: "Upload photo / ticket / receipt",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["file"],
                properties: {
                  file: { type: "string", format: "binary" },
                  category: {
                    type: "string",
                    enum: ["PHOTO", "TICKET", "RECEIPT", "CERTIFICATION", "OTHER"],
                    default: "PHOTO",
                  },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Attachment created" } },
      },
    },
    "/api/v1/approvals/pending": {
      get: {
        tags: ["Approvals"],
        summary: "Manager pending queue (SUBMITTED)",
        responses: { "200": { description: "Pending reports" } },
      },
    },
    "/api/v1/approvals/{id}": {
      get: {
        tags: ["Approvals"],
        summary: "Pending report detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Report detail" } },
      },
    },
    "/api/v1/approvals/{id}/approve": {
      post: {
        tags: ["Approvals"],
        summary: "Approve report",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Approved" } },
      },
    },
    "/api/v1/approvals/{id}/approve-with-notes": {
      post: {
        tags: ["Approvals"],
        summary: "Approve with notes (notes required)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ApproveWithNotes" },
            },
          },
        },
        responses: { "200": { description: "Approved with notes" } },
      },
    },
    "/api/v1/approvals/{id}/return": {
      post: {
        tags: ["Approvals"],
        summary: "Return for correction (comment required)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ReturnReport" },
            },
          },
        },
        responses: { "200": { description: "Returned" } },
      },
    },
    "/api/v1/billing/rollup": {
      get: {
        tags: ["Billing"],
        summary: "Project admin billing rollup",
        responses: { "200": { description: "Projects with approved/pending counts" } },
      },
    },
    "/api/v1/billing/projects/{projectId}": {
      get: {
        tags: ["Billing"],
        summary: "Approved-only drilldown",
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "Approved quantities + attachments" } },
      },
    },
    "/api/v1/billing/projects/{projectId}/export.csv": {
      get: {
        tags: ["Billing"],
        summary: "Export billing CSV backup",
        parameters: [
          {
            name: "projectId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "CSV file",
            content: { "text/csv": { schema: { type: "string" } } },
          },
        },
      },
    },
    "/api/v1/projects": {
      get: {
        tags: ["Projects"],
        summary: "List projects",
        responses: { "200": { description: "Projects" } },
      },
      post: {
        tags: ["Projects"],
        summary: "Create project",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/projects/lookups": {
      get: {
        tags: ["Projects"],
        summary: "Lookups (types, PMs, field leads)",
        responses: { "200": { description: "Lookups" } },
      },
    },
    "/api/v1/projects/{id}": {
      get: {
        tags: ["Projects"],
        summary: "Project detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Project" } },
      },
      patch: {
        tags: ["Projects"],
        summary: "Update project",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/projects/{id}/tasks": {
      post: {
        tags: ["Projects"],
        summary: "Create project task (assign field person)",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "201": { description: "Task created" } },
      },
    },
    "/api/v1/tasks": {
      get: {
        tags: ["Bid master"],
        summary: "List bid / task master",
        responses: { "200": { description: "Tasks" } },
      },
      post: {
        tags: ["Bid master"],
        summary: "Create bid / task master",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/tasks/{id}": {
      patch: {
        tags: ["Bid master"],
        summary: "Update bid / task master",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/tasks/import": {
      post: {
        tags: ["Bid master"],
        summary: "Import bid master rows (JSON body)",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  rows: {
                    type: "array",
                    items: { type: "object" },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "Import result" } },
      },
    },
    "/api/v1/project-types": {
      get: {
        tags: ["Project types"],
        summary: "List project types",
        responses: { "200": { description: "Types" } },
      },
      post: {
        tags: ["Project types"],
        summary: "Create project type",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/project-types/{id}": {
      patch: {
        tags: ["Project types"],
        summary: "Update project type",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Updated" } },
      },
    },
    "/api/v1/users": {
      get: {
        tags: ["Users"],
        summary: "List users",
        responses: { "200": { description: "Users" } },
      },
      post: {
        tags: ["Users"],
        summary: "Create user",
        responses: { "201": { description: "Created" } },
      },
    },
    "/api/v1/users/managers": {
      get: {
        tags: ["Users"],
        summary: "List managers (for assignment)",
        responses: { "200": { description: "Managers" } },
      },
    },
    "/api/v1/users/{id}": {
      get: {
        tags: ["Users"],
        summary: "User detail",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "User" } },
      },
      patch: {
        tags: ["Users"],
        summary: "Update user",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Updated" } },
      },
      delete: {
        tags: ["Users"],
        summary: "Deactivate user",
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Deactivated" } },
      },
    },
    "/api/v1/permissions": {
      get: {
        tags: ["Permissions"],
        summary: "Permission matrix",
        responses: { "200": { description: "Matrix" } },
      },
      put: {
        tags: ["Permissions"],
        summary: "Save permission matrix",
        responses: { "200": { description: "Saved" } },
      },
    },
    "/api/v1/crews": {
      get: {
        tags: ["Crews"],
        summary: "List crews",
        responses: { "200": { description: "Crews" } },
      },
    },
  },
} as const;

/** Default security: Bearer for all paths unless overridden with security: [] */
export function withDefaultSecurity(
  spec: typeof openApiSpec,
): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const [pathKey, methods] of Object.entries(spec.paths)) {
    const nextMethods: Record<string, unknown> = {};
    for (const [method, op] of Object.entries(
      methods as Record<string, Record<string, unknown>>,
    )) {
      const hasSecurity = Object.prototype.hasOwnProperty.call(op, "security");
      nextMethods[method] = hasSecurity
        ? op
        : { ...op, security: [{ bearerAuth: [] }] };
    }
    paths[pathKey] = nextMethods;
  }
  return { ...spec, paths };
}
