import jwt, { JwtPayload } from 'jsonwebtoken';
import asyncHandler from 'express-async-handler';
import { Request, Response, NextFunction } from 'express';
import AppError from '../utils/AppError.js';
// import { prisma } from '../prisma/prisma.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        exp?: number;
      };
    }
  }
}

/**
 * Middleware: Verify JWT for all authenticated users
 */
export const verifyJWT = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Unauthorized: No token provided', 401));
  }

  const token = authHeader.split(' ')[1];

  try {
    // Ensure ACCESS_TOKEN_SECRET exists
    const secret = process.env.ACCESS_TOKEN_SECRET;
    if (!secret) {
      throw new Error('ACCESS_TOKEN_SECRET is not defined in environment variables');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload & {
      userId: string;
    };

    req.user = decoded; // decoded contains userId, role, iat, exp
    next();

  } catch (err) {
    // Type guard for error
    if (err instanceof Error) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Unauthorized: Access token expired', 401));
      }
      return next(new AppError('Unauthorized: Invalid access token', 401));
    }
    return next(new AppError('Unauthorized: Unknown error', 401));
  }
});



