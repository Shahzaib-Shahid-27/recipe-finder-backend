<<<<<<< HEAD
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
=======
import AppError from "../utils/AppError.js"
import logger from "../utils/logger.js"
import bcrypt from "bcryptjs";

import authRepository from "../repositories/auth.repository.js"
import { generateAccessToken, generateRefreshToken } from "../utils/TokenGen.js"
import { getGoogleUser, GoogleAuthInput } from "../utils/googleAuth.js"

// ---------- Helpers ----------
const hashPassword = async (password: string): Promise<string> => {
    return await bcrypt.hash(password, 12);
};

const comparePasswords = async (password: string, hashedPassword: string): Promise<boolean> => {
    return await bcrypt.compare(password, hashedPassword);
};

// Generate tokens + store refresh token
const issueTokens = async (userId: string) => {
    const accessToken = generateAccessToken(userId);
    const refreshToken = generateRefreshToken(userId);

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setHours(refreshExpiresAt.getHours() + 8);

    await authRepository.storeRefreshToken(userId, refreshToken, refreshExpiresAt);

    return { accessToken, refreshToken };
};

// Hide sensitive data
const sanitizeUser = <T extends { password?: string | null; refreshToken?: string | null; expiresAt?: Date | null }>(user: T) => {
    const { password: _p, refreshToken: _r, expiresAt: _e, ...data } = user;
    return data;
};

// ---------- Email / Password ----------
const registerUser = async (name: string, email: string, password: string) => {
    if (!name) {
        logger.error("Name field is missing")
        throw new AppError("Name field is missing!", 400)
    }
    if (!email) {
        logger.error("Email field is missing")
        throw new AppError("Email field is missing!", 400)
    }
    if (!password) {
        logger.error("Password field is missing")
        throw new AppError("Password field is missing!", 400)
    }

    const existingUser = await authRepository.findUserByEmail(email);
    if (existingUser) {
        logger.error("User with this email already exists!")
        throw new AppError("User with this email already exists!", 400)
    }

    const hashedPassword = await hashPassword(password)

    const createUser = await authRepository.createUser(name, email, hashedPassword)
    if (!createUser) {
        logger.error("Failed to create user!")
        throw new AppError("Failed to create user!", 400)
    }

    const tokens = await issueTokens(createUser.id);

    return { tokens, data: sanitizeUser(createUser) }
}

const loginUser = async (email: string, password: string) => {
    if (!email) {
        logger.error("Email field is missing");
        throw new AppError("Email field is missing!", 400);
    }
    if (!password) {
        logger.error("Password field is missing");
        throw new AppError("Password field is missing!", 400);
    }

    const existingUser = await authRepository.findUserByEmail(email);
    if (!existingUser) {
        logger.error("User not found");
        throw new AppError("Invalid email or password", 401);
    }

    // Google-only account (no password set)
    if (!existingUser.password) {
        logger.error("Password login attempted on Google-only account");
        throw new AppError("This account uses Google Sign-In. Please continue with Google.", 400);
    }

    const isPasswordCorrect = await comparePasswords(password, existingUser.password);
    if (!isPasswordCorrect) {
        logger.error("Incorrect password");
        throw new AppError("Invalid email or password", 401);
    }

    const tokens = await issueTokens(existingUser.id);

    return { tokens, data: sanitizeUser(existingUser) };
};

// ---------- Google Signup / Login ----------
const googleAuth = async (input: GoogleAuthInput) => {
    // Verify with Google
    const googleUser = await getGoogleUser(input);

    let user = await authRepository.findUserByGoogleId(googleUser.googleId);
    let isNewUser = false;

    if (!user) {
        const existingByEmail = await authRepository.findUserByEmail(googleUser.email);

        if (existingByEmail) {
            // Email already registered (Google verified the email) -> link accounts
            user = await authRepository.linkGoogleAccount(
                existingByEmail.id,
                googleUser.googleId,
                googleUser.avatar
            );
            logger.info(`Google account linked to existing user ${user.id}`);
        } else {
            // Brand new user -> signup
            user = await authRepository.createGoogleUser(
                googleUser.name,
                googleUser.email,
                googleUser.googleId,
                googleUser.avatar
            );
            isNewUser = true;
            logger.info(`New user created via Google: ${user.id}`);
        }
    }

    const tokens = await issueTokens(user.id);

    return { tokens, isNewUser, data: sanitizeUser(user) };
};

// ---------- Password reset ----------
const forgotPassword = async (email: string) => {
    if (!email) {
        logger.error("Email field is missing")
        throw new AppError("Email field is missing!", 400)
    }

    const existingUser = await authRepository.findUserByEmail(email);
    if (!existingUser) {
        logger.error("User not found")
        throw new AppError("User not found", 404)
    }
>>>>>>> 01887a5ccc60b7acd31b0dc86ed3f051ec4194cd

const loginUser = async (
  email: string,
  password: string
) => {

<<<<<<< HEAD
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
=======
const resetPassword = async (email: string, newPassword: string) => {
    if (!email) {
        logger.error("Email is missing");
        throw new AppError("Email is missing!", 400);
    }
    if (!newPassword) {
        logger.error("New password is missing");
        throw new AppError("New password is missing!", 400);
    }

    const existingUser = await authRepository.findUserByEmail(email);
    if (!existingUser) {
        logger.error("User not found");
        throw new AppError("User not found", 404);
    }

    // Only compare if the user already has a password (Google users may not)
    if (existingUser.password) {
        const isSamePassword = await comparePasswords(newPassword, existingUser.password);
        if (isSamePassword) {
            logger.error("New password cannot be the same as current password");
            throw new AppError(
                "You cannot keep the same password. Please choose a different password!",
                400
            );
        }
    }

    const hashedPassword = await hashPassword(newPassword);
    await authRepository.updatePassword(existingUser.id, hashedPassword);
>>>>>>> 01887a5ccc60b7acd31b0dc86ed3f051ec4194cd

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

<<<<<<< HEAD

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

=======
// ---------- Profile & Tokens ----------
const getProfile = async (userId: string) => {
    if (!userId) {
        logger.error("UserId is missing!")
        throw new AppError("UserId is missing!", 400)
    }

    const existingUser = await authRepository.findUserById(userId);
    if (!existingUser) {
        logger.error("User not found");
        throw new AppError("User not found", 404);
    }

    return { data: sanitizeUser(existingUser) }
}

const refreshAccessToken = async (refreshToken: string) => {
    if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
    }

    const userToken = await authRepository.findUserByRefreshToken(refreshToken);
    if (!userToken) {
        throw new AppError("Invalid refresh token", 400);
    }

    if (!userToken.expiresAt || userToken.expiresAt < new Date()) {
        await authRepository.deleteRefreshToken(userToken.id);
        throw new AppError("Refresh token has expired", 401);
    }

    // Generates new tokens AND stores the new refresh token
    const { accessToken, refreshToken: newRefreshToken } = await issueTokens(userToken.id);

    return {
        newAccessToken: accessToken,
        newRefreshToken,
    };
}

export default {
    registerUser,
    loginUser,
    googleAuth,
    forgotPassword,
    resetPassword,
    getProfile,
    refreshAccessToken
}
>>>>>>> 01887a5ccc60b7acd31b0dc86ed3f051ec4194cd
