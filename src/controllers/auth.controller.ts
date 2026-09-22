import asyncHandler from "express-async-handler"
import { Request, Response } from "express"
import  authService  from "../services/auth.service.js"


const registerUser = asyncHandler(async (req: Request, res: Response) => {
    const {name, email, password} = req.body;

    const data = await authService.registerUser(name, email, password)

    res.status(201).json({
        status : "success",
        message: "User registered Successfully!",
        data
    })
})


const loginUser = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;

    const data = await authService.loginUser(email, password);

    res.status(200).json({
        status: "success",
        message: "Login successful!",
        data
    })

})

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
})

const resetPassword = asyncHandler( async (req: Request, res: Response) => {
    const { email, currentPassword, newPassword } = req.body;

    await authService.resetPassword(email, currentPassword, newPassword);

    res.status(200).json({
        status: "success",
        message: "Your password has been reset! , Now you can login",
    })
})

const getProfile = asyncHandler( async (req: Request, res: Response) => {
    const userId = String(req.user?.userId);

    const data = await authService.getProfile(userId);

    res.status(200).json({
         status: "success",
        message: "Profile fetched successfully",
        data
    })
})




// refresh token
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

export default {
    registerUser,
    loginUser,
    logout,
    forgotPassword,
    resetPassword,
    getProfile,
    refreshAccessToken
}