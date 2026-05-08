import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

/**
 * Validation middleware factory
 * Usage: app.post("/api/leads", validate(createLeadSchema), (req, res) => { ... })
 */
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error: any) {
      if (error.errors) {
        // Zod validation error
        const messages = error.errors.map(
          (err: any) => `${err.path.join(".")}: ${err.message}`
        );
        return res.status(400).json({
          error: "Validation failed",
          code: "VALIDATION_ERROR",
          statusCode: 400,
          details: messages,
        });
      }
      res.status(400).json({
        error: "Invalid request",
        code: "BAD_REQUEST",
        statusCode: 400,
      });
    }
  };
};

/**
 * Standard error response format
 */
export const errorResponse = (
  res: Response,
  statusCode: number,
  message: string,
  code: string = "ERROR"
) => {
  res.status(statusCode).json({
    error: message,
    code,
    statusCode,
  });
};
