/**
 * OpenAPI 3.0 Specification for Samha CRM API
 * Auto-generated from Zod schemas and route documentation
 */

export const openAPISpec = {
  openapi: "3.0.0",
  info: {
    title: "Samha CRM API",
    description:
      "Real estate CRM API for managing units, leads, deals, and commissions",
    version: "1.0.0",
    contact: {
      name: "Samha Development",
      email: "support@samha.dev",
    },
  },
  servers: [
    {
      url: "http://localhost:3000",
      description: "Development server",
    },
    {
      url: "https://api.samha.dev",
      description: "Production server",
    },
  ],
  paths: {
    "/health": {
      get: {
        summary: "Health check",
        tags: ["Health"],
        responses: {
          "200": {
            description: "Server is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/projects": {
      get: {
        summary: "Get all projects",
        tags: ["Projects"],
        responses: {
          "200": {
            description: "List of projects",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: {
                    $ref: "#/components/schemas/Project",
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create new project",
        tags: ["Projects"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "location", "totalUnits", "handoverDate"],
                properties: {
                  name: { type: "string" },
                  location: { type: "string" },
                  totalUnits: { type: "integer" },
                  handoverDate: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Project created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Project" },
              },
            },
          },
          "401": {
            $ref: "#/components/responses/Unauthorized",
          },
        },
      },
    },
    "/api/leads": {
      get: {
        summary: "Get leads with pagination",
        tags: ["Leads"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, maximum: 100 },
          },
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "source", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of leads",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Lead" },
                    },
                    pagination: {
                      $ref: "#/components/schemas/Pagination",
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create new lead",
        tags: ["Leads"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateLeadInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Lead created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Lead" },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/ValidationError",
          },
          "401": {
            $ref: "#/components/responses/Unauthorized",
          },
        },
      },
    },
    "/api/deals": {
      get: {
        summary: "Get deals with pagination",
        tags: ["Deals"],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 50, maximum: 100 },
          },
          { name: "stage", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Paginated list of deals",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Deal" },
                    },
                    pagination: {
                      $ref: "#/components/schemas/Pagination",
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        summary: "Create new deal",
        tags: ["Deals"],
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateDealInput" },
            },
          },
        },
        responses: {
          "201": {
            description: "Deal created with auto-calculated fees and payment schedule",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Deal" },
              },
            },
          },
          "400": {
            $ref: "#/components/responses/ValidationError",
          },
          "401": {
            $ref: "#/components/responses/Unauthorized",
          },
        },
      },
    },
    "/api/deals/{dealId}/stage": {
      patch: {
        summary: "Update deal stage",
        tags: ["Deals"],
        security: [{ BearerAuth: [] }],
        parameters: [
          {
            name: "dealId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["newStage"],
                properties: {
                  newStage: {
                    type: "string",
                    enum: [
                      "RESERVATION_PENDING",
                      "RESERVATION_CONFIRMED",
                      "SPA_PENDING",
                      "SPA_SENT",
                      "SPA_SIGNED",
                      "OQOOD_PENDING",
                      "OQOOD_REGISTERED",
                      "INSTALLMENTS_ACTIVE",
                      "HANDOVER_PENDING",
                      "COMPLETED",
                      "CANCELLED",
                    ],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Deal stage updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/Deal" },
              },
            },
          },
          "400": {
            description: "Invalid stage transition",
          },
          "401": {
            $ref: "#/components/responses/Unauthorized",
          },
        },
      },
    },
    "/api/reports/export/commissions/{brokerCompanyId}": {
      get: {
        summary: "Export commission statement as Excel",
        tags: ["Reports"],
        parameters: [
          {
            name: "brokerCompanyId",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "Excel file downloaded",
            content: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {},
            },
          },
        },
      },
    },
    "/api/reports/export/deals": {
      get: {
        summary: "Export deal report as Excel",
        tags: ["Reports"],
        parameters: [
          { name: "stage", in: "query", schema: { type: "string" } },
          { name: "startDate", in: "query", schema: { type: "string" } },
          { name: "endDate", in: "query", schema: { type: "string" } },
        ],
        responses: {
          "200": {
            description: "Excel file downloaded",
            content: {
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
                {},
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      BearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "JWT access token issued by /api/auth/login",
      },
    },
    schemas: {
      Project: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          location: { type: "string" },
          totalUnits: { type: "integer" },
          handoverDate: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Lead: {
        type: "object",
        properties: {
          id: { type: "string" },
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          stage: { type: "string" },
          budget: { type: "number" },
          source: { type: "string" },
          assignedAgent: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
            },
          },
        },
      },
      Deal: {
        type: "object",
        properties: {
          id: { type: "string" },
          dealNumber: { type: "string" },
          stage: { type: "string" },
          salePrice: { type: "number" },
          discount: { type: "number" },
          dldFee: { type: "number" },
          adminFee: { type: "number" },
          oqood: {
            type: "object",
            properties: {
              deadline: { type: "string", format: "date-time" },
              daysRemaining: { type: "integer" },
              status: { type: "string", enum: ["green", "yellow", "red", "overdue"] },
              isOverdue: { type: "boolean" },
            },
          },
          commission: {
            type: "object",
            properties: {
              amount: { type: "number" },
              status: { type: "string" },
              spaSignedMet: { type: "boolean" },
              oqoodRegisteredMet: { type: "boolean" },
            },
          },
        },
      },
      CreateLeadInput: {
        type: "object",
        required: ["firstName", "lastName", "phone", "source", "assignedAgentId"],
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          nationality: { type: "string" },
          source: {
            type: "string",
            enum: ["DIRECT", "BROKER", "WEBSITE", "REFERRAL"],
          },
          budget: { type: "number" },
          assignedAgentId: { type: "string" },
        },
      },
      CreateDealInput: {
        type: "object",
        required: ["leadId", "unitId", "salePrice", "paymentPlanId"],
        properties: {
          leadId: { type: "string" },
          unitId: { type: "string" },
          salePrice: { type: "number" },
          discount: { type: "number" },
          paymentPlanId: { type: "string" },
          brokerCompanyId: { type: "string" },
          brokerAgentId: { type: "string" },
        },
      },
      Pagination: {
        type: "object",
        properties: {
          page: { type: "integer" },
          limit: { type: "integer" },
          total: { type: "integer" },
          pages: { type: "integer" },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid authentication",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                code: { type: "string" },
                statusCode: { type: "integer" },
              },
            },
          },
        },
      },
      ValidationError: {
        description: "Input validation failed",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                code: { type: "string" },
                statusCode: { type: "integer" },
                details: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  },
};
