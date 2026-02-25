import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/api-error";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: err.message || "An unexpected error occurred" },
  });
}
