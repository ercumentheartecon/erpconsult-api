import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { sendError } from "../utils/api-response";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      sendError(res, "VALIDATION_ERROR", JSON.stringify(errors), 400);
      return;
    }
    req.body = result.data;
    next();
  };
}
