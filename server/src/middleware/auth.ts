import type { Request, Response, NextFunction } from 'express'

// Extend Express Request to include userId
declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

// Default single-user ID used until multi-user auth is implemented
const DEFAULT_USER_ID = 'default-user'

// TODO: Multi-user auth - extract JWT from Authorization header,
// validate it, and set req.userId from the token payload.
export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  req.userId = DEFAULT_USER_ID
  next()
}
