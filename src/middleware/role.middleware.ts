import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/api-response";

export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      sendError(res, "UNAUTHORIZED", "Authentication required", 401);
      return;
    }
    if (!roles.includes(req.user.role)) {
      sendError(res, "FORBIDDEN", "You do not have permission to access this resource", 403);
      return;
    }
    next();
  };
}
