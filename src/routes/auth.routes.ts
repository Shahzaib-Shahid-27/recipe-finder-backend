import { Router } from "express";
import authController from "../controllers/auth.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

export const authRouter = Router();

authRouter.post("/register",authController.register);

authRouter.post("/login",authController.login);

authRouter.get("/google",authController.googleRedirect);

authRouter.get("/google", authController.googleRedirect);

authRouter.get("/google/callback", authController.googleCallback);

authRouter.post('/forgot-password', authController.forgotPassword)

authRouter.post("/logout",authController.logout);

authRouter.post("/forgot-password",authController.forgotPassword);

authRouter.post("/reset-password",authController.resetPassword);

authRouter.post("/refresh",authController.refreshToken);

authRouter.get("/get-profile",verifyJWT,authController.getProfile);