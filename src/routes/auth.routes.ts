import { Router } from "express";
import authController from "../controllers/auth.controller.ts";
import {verifyJWT } from "../middlewares/auth.middleware.ts"

export const authRouter = Router();

authRouter.post('/register', authController.registerUser)

authRouter.post('/login', authController.loginUser)

authRouter.post('/logout', authController.logout)

authRouter.post('/forgot-password', authController.forgotPassword)

authRouter.post('/reset-password', authController.resetPassword)

authRouter.post('/refresh', authController.refreshAccessToken)

authRouter.get('/get-profile', verifyJWT, authController.getProfile)