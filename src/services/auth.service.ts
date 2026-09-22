import AppError from "../utils/AppError.js"
import logger from "../utils/logger.js"
import bcrypt from 'bcryptjs';

import  authRepository  from "../repositories/auth.repository.js"
import { generateAccessToken, generateRefreshToken } from "../utils/TokenGen.js"
import { log } from "console";


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

  // Compare password
  const isPasswordCorrect = await comparePasswords(
    password,
    existingUser.password
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


const resetPassword = async (
  email: string,
  currentPassword: string,
  newPassword: string
) => {
  // Field Validation
  if (!email) {
    logger.error("Email is missing");
    throw new AppError("Email is missing!", 400);
  }

  if (!currentPassword || !newPassword) {
    logger.error("Password fields are missing!");
    throw new AppError("Password fields are missing!", 400);
  }

  // Validate Email
  const existingUser = await authRepository.findUserByEmail(email);

  if (!existingUser) {
    logger.error("User not found");
    throw new AppError("User not found", 404);
  }

  // Check current password
  const isCurrentPasswordCorrect = await comparePasswords(
    currentPassword,
    existingUser.password
  );

  if (!isCurrentPasswordCorrect) {
    logger.error("Current password is incorrect");
    throw new AppError("Current password is incorrect!", 401);
  }

  // Check if new password is same as current password
  const isSamePassword = await comparePasswords(
    newPassword,
    existingUser.password
  );

  if (isSamePassword) {
    logger.error("New password cannot be the same as current password");
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



export default {
    registerUser,
    loginUser,
    forgotPassword,
    resetPassword,
    getProfile,
    refreshAccessToken

}