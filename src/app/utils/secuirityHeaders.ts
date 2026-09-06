import type { RequestHandler } from "express";
import helmet from "helmet";

export const applySecurityHeaders = (): RequestHandler => {
  return helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, 
  });
};