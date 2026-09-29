import AppError from "../utils/AppError.js"
import logger from "../utils/logger.js"
import bcrypt from 'bcryptjs';

//  for login by google 
import { OAuth2Client } from "google-auth-library";

import  authRepository  from "../repositories/auth.repository.js"
import { generateAccessToken, generateRefreshToken } from "../utils/TokenGen.js"



// Password hashing function as helper
const hashPassword = async (password: string): Promise<string> => {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
};

// Password comparison function as helper
const comparePasswords = async (password: string, hashedPassword: string): Promise<boolean> => {
    return await bcrypt.compare(password, hashedPassword);
};


const registerUser = async (name : string, email : string, password : string) => {
    
    // Fields Validation
    if(!name) {
        logger.error("Name field is missing")
        throw new AppError("Name field is missing!", 400)
    }

    if(!email) {
        logger.error("Email field is missing")
        throw new AppError("Email field is missing!", 400)
    }

    if(!password) {
        logger.error("Password field is missing")
        throw new AppError("Password field is missing!", 400)
    }

    // Validate Email (Check user with this email exists or not)
    const existingUser = await authRepository.findUserByEmail(email);
    if(existingUser) {
        logger.error("User with this email already exists!")
        throw new AppError("User with this email already exists!", 400)
    }

    // hashed password 
    const hashedPassword = await hashPassword(password)

    // Create User 
    const createUser = await authRepository.createUser(name, email, hashedPassword)
    if(!createUser) {
        logger.error("Failed to create user!")
        throw new AppError("Failed to create user!", 400)
    }
    
    // Token Generation
    const accessToken = generateAccessToken(createUser.id)
    const refreshToken = generateRefreshToken(createUser.id)

    const refreshExpiresAt = new Date();
    refreshExpiresAt.setHours(refreshExpiresAt.getHours() + 8); // Set expiry to 8 hours from now
    await authRepository.storeRefreshToken(createUser.id, refreshToken, refreshExpiresAt); 

    // Hide Sensitive Data
    const { password: _, refreshToken: _storedRefreshToken, expiresAt: _storedExpiresAt, ...data } = createUser;

    // Return Response 
    return {
        tokens: {
            accessToken,
            refreshToken
        },
        data
    }
}


const loginUser = async (email: string, password: string) => {
  // Fields Validation
  if (!email) {
    logger.error("Email field is missing");
    throw new AppError("Email field is missing!", 400);
  }

  if (!password) {
    logger.error("Password field is missing");
    throw new AppError("Password field is missing!", 400);
  }

  // Find user by email
  const existingUser = await authRepository.findUserByEmail(email);

  if (!existingUser) {
    logger.error("User not found");
    throw new AppError("Invalid email or password", 401);
  }

    const passwordHash = existingUser.password;
    if (!passwordHash) {
        logger.error("User password is missing");
        throw new AppError("Invalid email or password", 401);
    }

  // Compare password
  const isPasswordCorrect = await comparePasswords(
    password,
        passwordHash
  );

  // IMPORTANT: Reject incorrect password
  if (!isPasswordCorrect) {
    logger.error("Incorrect password");
    throw new AppError("Invalid email or password", 401);
  }

  // Token Generation
  const accessToken = generateAccessToken(existingUser.id);
  const refreshToken = generateRefreshToken(existingUser.id);

  const refreshExpiresAt = new Date();
  refreshExpiresAt.setHours(refreshExpiresAt.getHours() + 8);

  await authRepository.storeRefreshToken(
    existingUser.id,
    refreshToken,
    refreshExpiresAt
  );

  // Hide Sensitive Data
  const {
    password: _,
    refreshToken: _storedRefreshToken,
    expiresAt: _storedExpiresAt,
    ...data
  } = existingUser;

  // Return Response
  return {
    tokens: {
      accessToken,
      refreshToken,
    },
    data,
  };
};

const forgotPassword = async (email : string) => {
    
    // Field Validation
    if(!email) {
        logger.error("Email field is missing")
        throw new AppError("Email field is missing!", 400)
    }

     // Validate Email (Check user with this email exists or not)
    const existingUser = await authRepository.findUserByEmail(email);
    if(!existingUser) {
        logger.error("User not found")
        throw new AppError("User not found", 404)
    }

    return true;
}


const resetPassword = async (email: string,newPassword: string) => {

    // Field Validation
    if (!email) {
        logger.error("Email is missing");
        throw new AppError("Email is missing!", 400);
    }

    if (!newPassword) {
        logger.error("New password is missing");
        throw new AppError("New password is missing!", 400);
    }

    // Validate Email
    const existingUser = await authRepository.findUserByEmail(email);

    if (!existingUser) {
        logger.error("User not found");
        throw new AppError("User not found", 404);
    }

    if (!existingUser.password) {
        logger.error("User password is missing");
        throw new AppError("User password is missing", 400);
    }

    // Check if new password is same as current password
    const isSamePassword = await comparePasswords(
        newPassword,
        existingUser.password
    );

    if (isSamePassword) {
        logger.error(
            "New password cannot be the same as current password"
        );

        throw new AppError(
            "You cannot keep the same password. Please choose a different password!",
            400
        );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    await authRepository.updatePassword(
        existingUser.id,
        hashedPassword
    );

    return true;
};


const getProfile = async (userId : string) => {
    
    // Field Validation
    if(!userId) {
        logger.error("UserId is missing!")
        throw new AppError("UserId is missing!", 400)
    }

    // Existing User 
    const existingUser = await authRepository.findUserById(userId);

    if (!existingUser) {
        logger.error("User not found");
        throw new AppError("User not found", 404);
    }

    // Hide Sensitive Data
    const { password: _, refreshToken: _storedRefreshToken, expiresAt: _storedExpiresAt, ...data } = existingUser;


  return {
    data
  }
}


const refreshAccessToken = async (refreshToken : string) => {
    
    if (!refreshToken) {
        throw new AppError("Refresh token is required", 400);
    }

    const userToken = await authRepository.findUserByRefreshToken(refreshToken);

    if (!userToken) {
        throw new AppError("Invalid refresh token", 400);
    }

    // Check if refresh token is expired
    if (!userToken.expiresAt || userToken.expiresAt < new Date()) {
        await authRepository.deleteRefreshToken(userToken.id); // Invalidate the expired token
        throw new AppError("Refresh token has expired", 401);
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(userToken.id );
    const newRefreshToken = generateRefreshToken(userToken.id);


    return {
        newAccessToken,
        newRefreshToken,
    };
}


const googleLogin = async (idToken: string) => {
  if (!idToken) {
    logger.error("Google ID token is missing");

    throw new AppError(
      "Google ID token is required!",
      400
    );
  }

  const googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
  );

  let payload;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    payload = ticket.getPayload();
  } catch {
    logger.error(
      "Google ID token verification failed"
    );

    throw new AppError(
      "Invalid Google ID token.",
      401
    );
  }

  if (!payload) {
    logger.error(
      "Google token payload is missing"
    );

    throw new AppError(
      "Invalid Google account information.",
      401
    );
  }

  const googleId = payload.sub;
  const email = payload.email;
  const name = payload.name;

  if (!googleId || !email) {
    logger.error(
      "Google account information is incomplete"
    );

    throw new AppError(
      "Google account information is incomplete.",
      400
    );
  }

  if (payload.email_verified !== true) {
    logger.error(
      "Google email is not verified"
    );

    throw new AppError(
      "Google email is not verified.",
      401
    );
  }

  // 1. Find user using Google ID
  let user =
    await authRepository.findUserByGoogleId(
      googleId
    );

  // 2. If Google ID is not connected,
  //    search using email
  if (!user) {
    user =
      await authRepository.findUserByEmail(
        email
      );

    // Existing email account
    if (user) {
      user =
        await authRepository.updateGoogleId(
          user.id,
          googleId
        );
    }
  }

  // 3. Create a new Google account
  if (!user) {
    user =
      await authRepository.createUser(
        name || "Google User",
        email,
        await hashPassword(
          `${googleId}:${email}:${Date.now()}`
        ),
        googleId
      );
  }

  if (!user) {
    logger.error(
      "Failed to create/find Google user"
    );

    throw new AppError(
      "Unable to create Google account.",
      500
    );
  }

  // 4. Generate tokens
  const accessToken =
    generateAccessToken(user.id);

  const refreshToken =
    generateRefreshToken(user.id);

  // 5. Refresh token expiry
  const refreshExpiresAt = new Date();

  refreshExpiresAt.setHours(
    refreshExpiresAt.getHours() + 8
  );

  // 6. Store refresh token
  await authRepository.storeRefreshToken(
    user.id,
    refreshToken,
    refreshExpiresAt
  );

  // 7. Remove sensitive fields
  const {
    password: _password,
    refreshToken: _storedRefreshToken,
    expiresAt: _storedExpiresAt,
    ...data
  } = user;

  // 8. Return same structure as normal login
  return {
    tokens: {
      accessToken,
      refreshToken,
    },
    data,
  };
};


export default {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    getProfile,
    refreshAccessToken,

    googleLogin

}