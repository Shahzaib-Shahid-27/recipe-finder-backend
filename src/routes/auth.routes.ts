import { Router } from "express";
import authController from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authController.registerUser
);

authRouter.post(
  "/login",
  authController.loginUser
);


// Google OAuth
authRouter.get(
  "/google",
  authController.googleRedirect
);

authRouter.get(
  "/google/callback",
  authController.googleCallback
);


authRouter.post(
  "/logout",
  authController.logout
);

authRouter.post(
  "/forgot-password",
  authController.forgotPassword
);

authRouter.post(
  "/reset-password",
  authController.resetPassword
);

authRouter.post(
  "/refresh",
  authController.refreshAccessToken
);

authRouter.get(
  "/get-profile",
  verifyJWT,
  authController.getProfile
);