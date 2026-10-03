import { OAuth2Client } from "google-auth-library";
import bcrypt from "bcryptjs";
import AppError from "../utils/AppError.js";
import authRepository from "../repositories/auth.repository.js";

// IMPORTANT:
// Keep these imports pointing to the same files you already use
// in your project.

import {generateAccessToken,generateRefreshToken,} from "../utils/TokenGen.js";

const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

/*
|--------------------------------------------------------------------------
| Google OAuth Client
|--------------------------------------------------------------------------
*/

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);


/*
|--------------------------------------------------------------------------
| Register User
|--------------------------------------------------------------------------
*/

const registerUser = async (
  name: string,
  email: string,
  password: string
) => {

  const existingUser =
    await authRepository.findUserByEmail(email);

  if (existingUser) {
    throw new AppError(
      "User with this email already exists.",
      409
    );
  }

  const hashedPasswordValue =
    await hashPassword(password);

  const user =
    await authRepository.createUser(
      name,
      email,
      hashedPasswordValue
    );

  if (!user) {
    throw new AppError(
      "Unable to create user.",
      500
    );
  }

  const accessToken =
    generateAccessToken(user.id);

  const refreshToken =
    generateRefreshToken(user.id);

  const refreshExpiresAt =
    new Date();

  refreshExpiresAt.setHours(
    refreshExpiresAt.getHours() + 8
  );

  await authRepository.storeRefreshToken(
    user.id,
    refreshToken,
    refreshExpiresAt
  );

  const {
    password: _password,
    refreshToken: _storedRefreshToken,
    expiresAt: _storedExpiresAt,
    ...data
  } = user;

  return {
    tokens: {
      accessToken,
      refreshToken,
    },
    data,
  };
};


/*
|--------------------------------------------------------------------------
| Login User
|--------------------------------------------------------------------------
*/

const loginUser = async (
  email: string,
  password: string
) => {

  const user =
    await authRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError(
      "Invalid email or password.",
      401
    );
  }

  if (user.password === null) {
    throw new AppError(
      "Invalid email or password.",
      401
    );
  }

  const passwordMatch =
    await comparePassword(
      password,
      user.password
    );

  if (!passwordMatch) {
    throw new AppError(
      "Invalid email or password.",
      401
    );
  }

  const accessToken =
    generateAccessToken(user.id);

  const refreshToken =
    generateRefreshToken(user.id);

  const refreshExpiresAt =
    new Date();

  refreshExpiresAt.setHours(
    refreshExpiresAt.getHours() + 8
  );

  await authRepository.storeRefreshToken(
    user.id,
    refreshToken,
    refreshExpiresAt
  );

  const {
    password: _password,
    refreshToken: _storedRefreshToken,
    expiresAt: _storedExpiresAt,
    ...data
  } = user;

  return {
    tokens: {
      accessToken,
      refreshToken,
    },
    data,
  };
};


/*
|--------------------------------------------------------------------------
| Logout
|--------------------------------------------------------------------------
*/

const logout = async () => {
  return true;
};


/*
|--------------------------------------------------------------------------
| Forgot Password
|--------------------------------------------------------------------------
*/

const forgotPassword = async (
  email: string
) => {

  const user =
    await authRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError(
      "User with this email does not exist.",
      404
    );
  }

  return true;
};


/*
|--------------------------------------------------------------------------
| Reset Password
|--------------------------------------------------------------------------
*/

const resetPassword = async (
  email: string,
  newPassword: string
) => {

  const user =
    await authRepository.findUserByEmail(email);

  if (!user) {
    throw new AppError(
      "User not found.",
      404
    );
  }

  const hashedPassword = await hashPassword(newPassword);

  await authRepository.updatePassword(
    user.id,
    hashedPassword
  );

  return true;
};


/*
|--------------------------------------------------------------------------
| Get Profile
|--------------------------------------------------------------------------
*/

const getProfile = async (
  userId: string
) => {

  const user =
    await authRepository.findUserById(userId);

  if (!user) {
    throw new AppError(
      "User not found.",
      404
    );
  }

  const {
    password: _password,
    refreshToken: _refreshToken,
    expiresAt: _expiresAt,
    ...data
  } = user;

  return data;
};


/*
|--------------------------------------------------------------------------
| Refresh Access Token
|--------------------------------------------------------------------------
*/

const refreshAccessToken = async (
  refreshToken: string
) => {

  if (!refreshToken) {
    throw new AppError(
      "Refresh token is required.",
      401
    );
  }

  const storedToken =
    await authRepository.findUserByRefreshToken(
      refreshToken
    );

  if (!storedToken) {
    throw new AppError(
      "Invalid refresh token.",
      401
    );
  }

  if (
    !storedToken.expiresAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new AppError(
      "Refresh token expired.",
      401
    );
  }

  const newAccessToken =
    generateAccessToken(
      storedToken.id
    );

  const newRefreshToken =
    generateRefreshToken(
      storedToken.id
    );

  const refreshExpiresAt =
    new Date();

  refreshExpiresAt.setHours(
    refreshExpiresAt.getHours() + 8
  );

  await authRepository.storeRefreshToken(
    storedToken.id,
    newRefreshToken,
    refreshExpiresAt
  );

  return {
    newAccessToken,
    newRefreshToken,
  };
};


/*
|--------------------------------------------------------------------------
| GOOGLE - Generate Authorization URL
|--------------------------------------------------------------------------
*/

const getGoogleAuthUrl = (): string => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError("GOOGLE_CLIENT_ID is missing.", 500);
  }

  if (!process.env.GOOGLE_CLIENT_SECRET) {
    throw new AppError("GOOGLE_CLIENT_SECRET is missing.", 500);
  }

  if (!process.env.GOOGLE_REDIRECT_URI) {
    throw new AppError("GOOGLE_REDIRECT_URI is missing.", 500);
  }

  return googleClient.generateAuthUrl({
    access_type: "offline",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
};  


/*
|--------------------------------------------------------------------------
| GOOGLE - Callback
|--------------------------------------------------------------------------
*/

const googleCallback = async (code: string) => {
  if (!code) {
    throw new AppError(
      "Google authorization code is missing.",
      400
    );
  }

  try {
    const { tokens } = await googleClient.getToken(code);

    console.log("Google tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasIdToken: !!tokens.id_token,
    });

    if (!tokens.id_token) {
      throw new AppError(
        "Google ID token was not returned.",
        401
      );
    }

    return await googleLogin(tokens.id_token);
  } catch (error) {
    console.error("GOOGLE CALLBACK ERROR:", error);

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


/*
|--------------------------------------------------------------------------
| GOOGLE - Login
|--------------------------------------------------------------------------
*/

const googleLogin = async (
  idToken: string
) => {

  if (!idToken) {
    throw new AppError(
      "Google ID token is required.",
      400
    );
  }

  let payload;

  try {

    const ticket =
      await googleClient.verifyIdToken({
        idToken,

        audience:
          process.env.GOOGLE_CLIENT_ID,
      });

    payload =
      ticket.getPayload();

  } catch {

    throw new AppError(
      "Invalid Google ID token.",
      401
    );
  }

  if (!payload) {
    throw new AppError(
      "Invalid Google account information.",
      401
    );
  }

  const googleId =
    payload.sub;

  const email =
    payload.email;

  const name =
    payload.name;


  if (!googleId || !email) {
    throw new AppError(
      "Google account information is incomplete.",
      400
    );
  }


  if (
    payload.email_verified !== true
  ) {
    throw new AppError(
      "Google email is not verified.",
      401
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Find by Google ID
  |--------------------------------------------------------------------------
  */

  let user =
    await authRepository.findUserByGoogleId(
      googleId
    );


  /*
  |--------------------------------------------------------------------------
  | Find by Email
  |--------------------------------------------------------------------------
  */

  if (!user) {

    user =
      await authRepository.findUserByEmail(
        email
      );

    if (user) {

      user =
        await authRepository.updateGoogleId(
          user.id,
          googleId
        );
    }
  }


  /*
  |--------------------------------------------------------------------------
  | Create User
  |--------------------------------------------------------------------------
  */

  if (!user) {

    const randomPassword =
      `${googleId}:${email}:${Date.now()}`;

    const hashedPassword =
      await hashPassword(
        randomPassword
      );

    user =
      await authRepository.createUser(
        name || "Google User",
        email,
        hashedPassword,
        googleId
      );
  }


  if (!user) {
    throw new AppError(
      "Unable to create Google account.",
      500
    );
  }


  /*
  |--------------------------------------------------------------------------
  | Generate JWT
  |--------------------------------------------------------------------------
  */

  const accessToken =
    generateAccessToken(
      user.id
    );

  const refreshToken =
    generateRefreshToken(
      user.id
    );


  const refreshExpiresAt =
    new Date();

  refreshExpiresAt.setHours(
    refreshExpiresAt.getHours() + 8
  );


  await authRepository.storeRefreshToken(
    user.id,
    refreshToken,
    refreshExpiresAt
  );


  /*
  |--------------------------------------------------------------------------
  | Remove Sensitive Fields
  |--------------------------------------------------------------------------
  */

  const {
    password: _password,
    refreshToken: _storedRefreshToken,
    expiresAt: _storedExpiresAt,
    ...data
  } = user;


  return {

    tokens: {
      accessToken,
      refreshToken,
    },

    data,

  };
};


/*
|--------------------------------------------------------------------------
| EXPORT
|--------------------------------------------------------------------------
*/

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

