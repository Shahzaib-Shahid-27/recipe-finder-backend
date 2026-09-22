import chalk from 'chalk';
import AppError from "../utils/AppError.js";
import logger from '../utils/logger.js';
import { Request, Response, NextFunction } from 'express';

// Extend Request interface to include optional properties
declare global {
  namespace Express {
    interface Request {
      id?: string;
      requestId?: string;
      user?: {
        userId: string;
        exp?: number;
      };
    }
  }
}

// Define custom error interface that extends Error
interface CustomError extends Error {
  isOperational?: boolean;
  statusCode?: number;
}

function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check if it's an AppError (operational)
  const isAppError = err instanceof AppError;
  const isOperational = err.isOperational || isAppError || false;

  const statusCode = err.statusCode || (isOperational ? 400 : 500);
  const message = err.message || 'Internal Server Error';
  const requestId = req.id || req.requestId || 'no-id';

  // Log error using Winston
  if (isOperational) {
    logger.warn(`Operational Error [${statusCode}]: ${message}`, {
      requestId,
      path: req.path,
      method: req.method,
      statusCode,
      userId: req.user?.userId,
    });
  } else {
    logger.error(`Unexpected Error [${statusCode}]: ${message}`, {
      requestId,
      path: req.path,
      method: req.method,
      statusCode,
      stack: err.stack,
      userId: req.user?.userId,
    });
  }

  // Development: Also show styled console output
  if (process.env.NODE_ENV !== 'production') {
    console.log('\n' + chalk.bgRed.white.bold(' 💥 ERROR CAUGHT ') + '\n');
    console.log(chalk.redBright(`Message: ${message}`));
    console.log(chalk.yellowBright(`Status: ${statusCode}`));
    console.log(chalk.blueBright(`Operational: ${isOperational}`));

    if (!isOperational) {
      console.log(chalk.bgYellow.black(' ⚠️  Unexpected (Non-operational) Error '));
    }

    if (err.stack) {
      console.log(chalk.gray('\nStack:\n' + err.stack));
    }

    console.log(chalk.red('----------------------------------------------------------\n'));
  }

  // Build response (safe for production)
  interface ErrorPayload {
    success: boolean;
    message: string;
    requestId: string;
    error?: {
      name: string;
      stack?: string;
      isOperational: boolean;
    };
  }

  const payload: ErrorPayload = {
    success: false,
    message: isOperational ? message : 'Something went wrong on the server.',
    requestId,
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.error = {
      name: err.name,
      stack: err.stack,
      isOperational,
    };
  }

  res.status(statusCode).json(payload);
}

export default errorHandler;