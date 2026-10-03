
  import { Request, Response } from "express";

  import authService from "../services/auth.service.js";
  import AppError from "../utils/AppError.js";



  // ==============================
  // REGISTER
  // ==============================

  const register =  (
    async (req: Request, res: Response) => {
      const {
        name,
        email,
        password,
      } = req.body;

      if (!name || !email || !password) {
        throw new AppError(
          "Name, email and password are required.",
          400
        );
      }

      const result =
        await authService.registerUser(
          name,
          email,
          password
        );

      res.status(201).json({
        success: true,
        message: "User registered successfully.",
        data: result,
      });
    }
  );

  // ==============================
  // LOGIN
  // ==============================

  const login = (
    async (req: Request, res: Response) => {
      const {
        email,
        password,
      } = req.body;

      if (!email || !password) {
        throw new AppError(
          "Email and password are required.",
          400
        );
      }

      const result =
        await authService.loginUser(
          email,
          password
        );

      res.status(200).json({
        success: true,
        message: "Login successful.",
        data: result,
      });
    }
  );

  // ==============================
  // LOGOUT
  // ==============================

  const logout = (
    async (req: Request, res: Response) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(
          "Unauthorized.",
          401
        );
      }

      await authService.logout(userId);

      res.status(200).json({
        success: true,
        message: "Logged out successfully.",
      });
    }
  );

  // ==============================
  // FORGOT PASSWORD
  // ==============================

  const forgotPassword = (
    async (req: Request, res: Response) => {
      const { email } = req.body;

      if (!email) {
        throw new AppError(
          "Email is required.",
          400
        );
      }

      await authService.forgotPassword(
        email
      );

      res.status(200).json({
        success: true,
        message:
          "If an account with this email exists, password reset instructions will be sent.",
      });
    }
  );

  // ==============================
  // RESET PASSWORD
  // ==============================

  const resetPassword = (
    async (req: Request, res: Response) => {
      const {
        email,
        newPassword,
      } = req.body;

      if (!email || !newPassword) {
        throw new AppError(
          "Email and new password are required.",
          400
        );
      }

      await authService.resetPassword(
        email,
        newPassword
      );

      res.status(200).json({
        success: true,
        message:
          "Password reset successfully.",
      });
    }
  );

  // ==============================
  // GET PROFILE
  // ==============================

  const getProfile = (
    async (req: Request, res: Response) => {
      const userId = req.user?.userId;

      if (!userId) {
        throw new AppError(
          "Unauthorized.",
          401
        );
      }

      const user =
        await authService.getProfile(
          userId
        );

      res.status(200).json({
        success: true,
        data: user,
      });
    }
  );

  // ==============================
  // REFRESH TOKEN
  // ==============================

  const refreshToken = (
    async (req: Request, res: Response) => {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new AppError(
          "Refresh token is required.",
          400
        );
      }

      const tokens =
        await authService.refreshAccessToken(
          refreshToken
        );

      res.status(200).json({
        success: true,
        message:
          "Access token refreshed successfully.",
        data: tokens,
      });
    }
  );

  // ==============================
  // GOOGLE REDIRECT
  // ==============================

  const googleRedirect = (
    async (_req: Request, res: Response) => {
      const url =
        authService.getGoogleAuthUrl();

      res.redirect(url);
    }
  );

  // ==============================
  // GOOGLE CALLBACK
  // ==============================

  const googleCallback = (
    async (
      req: Request,
      res: Response
    ) => {
      const { code } = req.query;

      if (
        !code ||
        typeof code !== "string"
      ) {
        throw new AppError(
          "Google authorization code is missing.",
          400
        );
      }

      const result =
        await authService.googleCallback(
          code
        );

      const frontendUrl = 
      process.env.FRONTEND_URL ||
        "http://localhost:5173";

      res.redirect(
        `${frontendUrl}/google-success?accessToken=${encodeURIComponent(
          result.tokens.accessToken
        )}`
      );
    }
  );

  // ==============================
  // EXPORT
  // ==============================

  export default {
    register,
    login,
    logout,
    forgotPassword,
    resetPassword,
    getProfile,
    refreshToken,
    googleRedirect,
    googleCallback,
  };
