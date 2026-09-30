import asyncHandler from "express-async-handler"
import { Request, Response } from "express"
import  authService  from "../services/auth.service.js"
import crypto from "crypto"
import AppError from "../utils/AppError.js"
import { getGoogleAuthUrl } from "../utils/googleAuth.js"
import logger from "../utils/logger.js"


const registerUser = asyncHandler(async (req: Request, res: Response) => {
    const {name, email, password} = req.body;

    const data = await authService.registerUser(name, email, password)

    res.status(201).json({
        status : "success",
        message: "User registered Successfully!",
        data
    })
});

const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const data = await authService.loginUser(email, password);

    res.status(200).json({
        status: "success",
        message: "Login successful!",
        data
    })

});

const logout = asyncHandler( async (_req: Request, res: Response) => {
   res.status(200).json({
    success: true,
    message: "Logout successful",
  });
});

const forgotPassword = asyncHandler( async (req : Request, res: Response) => {
    const { email } = req.body;

    await authService.forgotPassword(email)

    res.status(200).json({
        status: "success",
        message: "Email Verified! , Now you can reset password"
    })
});

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email, newPassword } = req.body;

    await authService.resetPassword(email, newPassword);

    res.status(200).json({
        status: "success",
        message: "Your password has been reset! Now you can login",
    });
});

const getProfile = asyncHandler( async (req: Request, res: Response) => {
    const userId = String(req.user?.userId);

    const data = await authService.getProfile(userId);

    res.status(200).json({
         status: "success",
        message: "Profile fetched successfully",
        data
    })
});

const googleLoginController = asyncHandler( async (req: Request, res: Response) => {

    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({
        status: "error",
        message: "Google credential is required.",
      });
      return;
    }

    const data = await authService.googleLogin(credential);

    res.status(200).json({
      status: "success",
      message: "Google login successful!",
      data,
    });
  }
);




// Refresh token
const refreshAccessToken = asyncHandler(
  async (req: Request, res: Response) => {
    const refreshToken = String(req.headers.refreshtoken);

    const { newAccessToken, newRefreshToken } =
      await authService.refreshAccessToken(refreshToken);

    res.status(200).json({
      status: "success",
      message: "Token refreshed successfully",
      tokens: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  }
);

const STATE_COOKIE = "google_oauth_state";

// Step 1: send user to Google
const googleRedirect = (_req: Request, res: Response) => {
    const state = crypto.randomBytes(32).toString("hex");

    res.cookie(STATE_COOKIE, state, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 10 * 60 * 1000, // 10 minutes
    });

    res.redirect(getGoogleAuthUrl(state));
};

// Step 2: Google sends user back here with ?code=...&state=...
const googleCallback = asyncHandler(async (req: Request, res: Response) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const fail = (message: string) =>
        res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(message)}`);

    const { code, state, error } = req.query;
    const savedState = req.cookies?.[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE);

    if (error) {
        return fail("Google sign-in was cancelled.");
    }

    if (
        typeof code !== "string" ||
        typeof state !== "string" ||
        !savedState ||
        state !== savedState
    ) {
        return fail("Invalid Google sign-in request. Please try again.");
    }

    try {
        const { tokens, isNewUser } = await authService.googleAuth({ code });

        const params = new URLSearchParams({
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isNewUser: String(isNewUser),
        });

        const target = `${frontendUrl}/auth/google/callback`;

        // 👇 NEW: shows where the browser is being sent
        logger.info(`Google login OK. FRONTEND_URL=${process.env.FRONTEND_URL} -> redirecting to ${target}`);

        res.redirect(`${target}#${params.toString()}`);
    } catch (err) {
        logger.error(`Google callback failed: ${(err as Error).stack ?? err}`);
        fail(err instanceof AppError ? err.message : "Google sign-in failed.");
    }
});

export default {
    registerUser,
    loginUser,
    googleRedirect,
    googleCallback,
    logout,
    forgotPassword,
    resetPassword,
    getProfile,
    refreshAccessToken,

    googleLoginController
}
