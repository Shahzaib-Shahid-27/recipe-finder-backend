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

    return true;
}

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

    return true;
};

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