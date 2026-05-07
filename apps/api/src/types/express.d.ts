import "express";

declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        role?: string;
      };
    }
  }
}

export {};
