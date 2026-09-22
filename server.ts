import dotenv from "dotenv";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';

import AppError from './src/utils/AppError.js';
import logger from './src/utils/logger.js';
import errorHandler from './src/middlewares/errorHandler.middleware.js';

import {mealsRouter} from "./src/routes/meals.routes.js";
import { authRouter } from './src/routes/auth.routes.js';

import { Request , Response , NextFunction } from 'express';
import { Socket } from 'net';


declare global {
namespace Express {
    interface Request {
    id?: string;
    requestId?: string;
    }
}
}

const app = express();
const PREFIX = '/api/v1'

if (process.env.NODE_ENV === 'production') {
app.set('trust proxy', 1);
}

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "https://recipe-finder-frontend-livid.vercel.app",
];

app.use(
  cors({
   origin: function (origin, callback) {
  console.log("CORS Origin:", origin);

  if (!origin) {
    return callback(null, true);
  }

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  console.log("CORS BLOCKED:", origin);

  return callback(new Error("Not allowed by CORS"));
},

    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(helmet({
contentSecurityPolicy: {
    directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    },
},
crossOriginEmbedderPolicy: false,
}));

app.use(morgan((tokens, req, res) => {
const status = Number(tokens.status(req, res) || 0);
const isError = status >= 400;
const requestId = req.id || req.requestId || 'no-id';
return [
    '\n----------------------------------------------------------',
    `\nRequest-ID: ${requestId}`,
    `\nMethod: ${tokens.method(req, res)}`,
    `\nURL: ${tokens.url(req, res)}`,
    `\nStatus: ${status} ${isError ? '❌ ERROR' : '✅ OK'}`,
    `\nTime: ${tokens['response-time'](req, res)} ms`,
    `\nIP: ${tokens['remote-addr'](req, res)}`,
    '\n----------------------------------------------------------',
].join(' ');
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// ========================================
// ROUTES - MUST BE HERE, AFTER MIDDLEWARE
// =======================================
// 

// Health check route
app.get('/health', (req: Request, res: Response) => {
res.status(200).json({ 
    status: 'ok', 
    timestamp: new Date().toISOString() 
});
});

// Root route
app.get("/", (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: "Recipe Finder Backend is running",
  });
});

// Favicon
app.get('/favicon.ico', (req: Request, res: Response) => res.status(204).end());


// API routes
app.use(`${PREFIX}/auth`, authRouter);
app.use(`${PREFIX}/meals`, mealsRouter);

// ========================================
// ERROR HANDLERS - MUST BE LAST
// ========================================

// 404 handler
app.use((req: Request, res: Response, next: NextFunction) => {
next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

// Global error handler
app.use(errorHandler);

// ========================================
// SERVER STARTUP
// ========================================

let server: any;
let isShuttingDown = false;
const sockets = new Set<Socket>();

async function start() {

const PORT = Number(process.env.PORT) || 8080;

server = app.listen(PORT, "0.0.0.0", () => {
  logger.info(`[Server] Server is running on port ${PORT}`);
});
  // Track all socket connections
  server.on('connection', (socket: Socket) => {
    sockets.add(socket);
    
    socket.on('close', () => {
      sockets.delete(socket);
    });
  });

  // Graceful shutdown handlers
  const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      if (isShuttingDown) return; // Prevent multiple calls
      isShuttingDown = true;
      await gracefulShutdown(signal);
    });
  });

  return server;
}

const gracefulShutdown = async (signal?: string) => {
  logger.info(`[Server] ${signal} received, starting graceful shutdown...`);
  
  // 1. Close database
  try {
    const { prisma } = await import('./src/prisma/prisma.js');
    await prisma.$disconnect();
    logger.info('[Server] Database connection closed');
  } catch (error) {
    logger.error('[Server] Error closing database:', error);
  }

  // 2. Development: immediate exit
  if (process.env.NODE_ENV === 'development') {
    logger.info('[Server] Development mode - immediate shutdown ✅');
    process.exit(0);
    return;
  }

  // 3. Production: destroy all connections
  if (server) {
    let hasExited = false;

    // Destroy all active sockets
    logger.info(`[Server] Destroying ${sockets.size} socket connection(s)`);
    sockets.forEach((socket) => {
      socket.destroy();
    });
    sockets.clear();

    // Close server
    server.close(() => {
      if (!hasExited) {
        hasExited = true;
        logger.info('[Server] HTTP server closed ✅');
        process.exit(0);
      }
    });

    // Backup force exit
    setTimeout(() => {
      if (!hasExited) {
        hasExited = true;
        logger.info('[Server] Force exit ✅');
        process.exit(0);
      }
    }, 500); // Only 500ms timeout now
    
  } else {
    process.exit(0);
  }
};

// Error handlers (prevent double registration)
process.removeAllListeners('unhandledRejection');
process.removeAllListeners('uncaughtException');

process.on('unhandledRejection', async (reason) => {
  logger.error('[Server] Unhandled Rejection:', reason instanceof Error ? reason.stack : reason);
  if (!isShuttingDown) {
    await gracefulShutdown('unhandledRejection');
  }
});

process.on('uncaughtException', async (err) => {
  logger.error('[Server] Uncaught Exception:', err?.stack || err);
  if (!isShuttingDown) {
    await gracefulShutdown('uncaughtException');
  }
});

if (process.env.NODE_ENV !== 'test') {
  start();
}

export default app;