import {generateAccessToken,generateRefreshToken,} from "../utils/TokenGen.js";
import authRepository from "../repositories/auth.repository.js";
import { OAuth2Client } from "google-auth-library";
import AppError from "../utils/AppError.js";
import bcrypt from "bcryptjs";

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

const getRefreshTokenExpiry = (): Date =>
  new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

const comparePassword = async (password: string,hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ==============================
// REGISTER


const registerUser = async (name: string, email: string, password: string) => {

  const existingUser = await authRepository.findUserByEmail(email);

  if (existingUser) {
    throw new AppError("User with this email already exists.", 409);
  }

  const hashedPassword = await hashPassword(password);

  const user = await authRepository.createUser(
    name,
    email,
    hashedPassword
  );

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await authRepository.storeRefreshToken(
    user.id,
    refreshToken,
    getRefreshTokenExpiry()
  );

  const { password: _, ...safeUser } = user;

  return {
    tokens: {
      accessToken,
      refreshToken,
    },
    user: safeUser,
  };
};

// ==============================
// LOGIN

const loginUser = async ( email: string, password: string) => {
  
  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (!user.password) {
    throw new AppError(
      "This account does not have a password. Please use Google login.",
      401
    );
  }

  const passwordMatch = await comparePassword(
    password,
    user.password
  );

  if (!passwordMatch) {
    throw new AppError("Invalid email or password.", 401);
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  await authRepository.storeRefreshToken(
    user.id,
    refreshToken,
    getRefreshTokenExpiry()
  );

  const { password: _, ...safeUser } = user;

  return {
    tokens: {
      accessToken,
      refreshToken,
    },
    user: safeUser,
  };
};

// ==============================
// LOGOUT

const logout = async (userId: string) => {

  const user = await authRepository.findUserById(userId);

  if (user?.refreshToken) {
    await authRepository.deleteRefreshToken(user.refreshToken);
  }

  return true;
};

// ==============================
// FORGOT PASSWORD

const forgotPassword = async (email: string) => {

  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    return true;
  }

  // Password reset email can be added here later.
  return true;
};

// ==============================
// RESET PASSWORD

const resetPassword = async ( email: string, newPassword: string) => {

  const user = await authRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const hashedPassword = await hashPassword(newPassword);

  await authRepository.updatePassword(
    user.id,
    hashedPassword
  );

  return true;
};

// ==============================
// GET PROFILE

const getProfile = async (userId: string) => {
  const user = await authRepository.findUserById(userId);

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  const { password: _, ...safeUser } = user;

  return safeUser;
};

// ==============================
// REFRESH ACCESS TOKEN


const refreshAccessToken = async ( refreshToken: string ) => {

  const storedToken = await authRepository.findUserByRefreshToken(
      refreshToken
    );

  if (!storedToken) {
    throw new AppError("Invalid refresh token.", 401);
  }

  if (
    storedToken.expiresAt &&
    new Date(storedToken.expiresAt) < new Date()
  ) {

    throw new AppError("Refresh token expired.", 401);
  }

  const accessToken = generateAccessToken(
    storedToken.id
  );

  const newRefreshToken = generateRefreshToken(
    storedToken.id
  );

  await authRepository.storeRefreshToken(
    storedToken.id,
    newRefreshToken,
    getRefreshTokenExpiry()
  );

  return {
    accessToken,
    refreshToken: newRefreshToken,
  };
};

// ==============================
// GOOGLE REDIRECT URL

const getGoogleAuthUrl = (): string => {

  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError(
      "GOOGLE_CLIENT_ID is missing.",
      500
    );
  }

  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(
      "GOOGLE_CLIENT_SECRET is missing.",
      500
    );
  }

  if (!process.env.GOOGLE_REDIRECT_URI) {
    throw new AppError(
      "GOOGLE_REDIRECT_URI is missing.",
      500
    );
  }

  return googleClient.generateAuthUrl({
    access_type: "offline",
    scope: [
      "openid",
      "email",
      "profile",
    ],
    prompt: "select_account",
  });
};

// ==============================
// GOOGLE CALLBACK

const googleCallback = async (code: string) => {
  if (!code) {
    throw new AppError(
      "Google authorization code is missing.",
      400
    );
  }

  try {
    const { tokens } = await googleClient.getToken(code);

    if (!tokens.id_token) {
      throw new AppError(
        "Google ID token was not returned.",
        401
      );
    }

    return await googleLogin(tokens.id_token);
  } catch (error) {
    console.error(
      "GOOGLE CALLBACK ERROR:",
      error
    );

    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new AppError(
        `Google authentication failed: ${error.message}`,
        401
      );
    }

    throw new AppError(
      "Google authentication failed.",
      401
    );
  }
};

// ==============================
// GOOGLE LOGIN

const googleLogin = async ( idToken: string ) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError(
      "GOOGLE_CLIENT_ID is missing.",
      500
    );
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      throw new AppError(
        "Invalid Google token.",
        401
      );
    }

    const googleId = payload.sub;
    const email = payload.email;
    const name = payload.name;

    if (!googleId || !email) {
      throw new AppError(
        "Google account information is incomplete.",
        401
      );
    }

    if (payload.email_verified !== true) {
      throw new AppError(
        "Google email is not verified.",
        401
      );
    }

    // Find user using Google ID
    let user =
      await authRepository.findUserByGoogleId(
        googleId
      );

    // If not found, find user using email
    if (!user) {
      user =
        await authRepository.findUserByEmail(
          email
        );

    }

    // Create a new user
    if (!user) {
      const randomPassword = `${googleId}:${email}:${Date.now()}`;

      const hashedPassword =
        await hashPassword(randomPassword);

      user =
        await authRepository.createUser(
          name || "Google User",
          email,
          hashedPassword,
          googleId
        );
    }

    const accessToken = generateAccessToken(
      user.id
    );

    const refreshToken = generateRefreshToken(
      user.id
    );

    await authRepository.storeRefreshToken(
      user.id,
      refreshToken,
      getRefreshTokenExpiry()
    );

    const { password: _, ...safeUser } = user;

    return {
      tokens: {
        accessToken,
        refreshToken,
      },
      user: safeUser,
    };

  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (error instanceof Error) {
      throw new AppError(
        `Google authentication failed: ${error.message}`,
        401
      );
    }

    throw new AppError(
      "Google authentication failed.",
      401
    );
  }
};

// ==============================
// EXPORT

export default {
  registerUser,
  loginUser,
  logout,
  forgotPassword,
  resetPassword,
  getProfile,
  refreshAccessToken,
  googleLogin,
  getGoogleAuthUrl,
  googleCallback,
};
