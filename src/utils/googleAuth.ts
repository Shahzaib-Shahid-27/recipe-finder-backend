import { OAuth2Client } from "google-auth-library";
import AppError from "./AppError.js";
import logger from "./logger.js";

export interface GoogleUser {
  googleId: string;
  email: string;
  name: string;
  avatar: string | null;
}

export interface GoogleAuthInput {
  idToken?: string;
  code?: string;
}

// Created lazily so env vars are read after dotenv has loaded
let client: OAuth2Client | null = null;

const getClient = (): OAuth2Client => {
  if (client) return client;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    logger.error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is not set");
    throw new AppError("Google authentication is not configured", 500);
  }

  client = new OAuth2Client(clientId, clientSecret, redirectUri);
  return client;
};

// Verify a Google ID token and extract the user's info
const verifyIdToken = async (idToken: string): Promise<GoogleUser> => {
  const oauthClient = getClient();

  try {
    const ticket = await oauthClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID, // token must be issued for OUR app
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      throw new AppError("Invalid Google token payload", 401);
    }

    if (!payload.email_verified) {
      throw new AppError("Google email is not verified", 401);
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.email.split("@")[0],
      avatar: payload.picture ?? null,
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error(`Google ID token verification failed: ${(error as Error).message}`);
    throw new AppError("Invalid or expired Google token", 401);
  }
};

// Exchange an authorization code for tokens, then verify the returned ID token
const exchangeCode = async (code: string): Promise<GoogleUser> => {
  const oauthClient = getClient();

  try {
    const { tokens } = await oauthClient.getToken(code);

    if (!tokens.id_token) {
      throw new AppError("Google did not return an ID token", 401);
    }

    return await verifyIdToken(tokens.id_token);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error(`Google code exchange failed: ${(error as Error).message}`);
    throw new AppError("Invalid or expired Google authorization code", 401);
  }
};

// Main helper: accepts either an idToken or a code
export const getGoogleUser = async ({ idToken, code }: GoogleAuthInput): Promise<GoogleUser> => {
  if (idToken) return verifyIdToken(idToken);
  if (code) return exchangeCode(code);

  throw new AppError("Google idToken or code is required", 400);
};

// Build the URL that sends the user to Google's login page
export const getGoogleAuthUrl = (state: string): string => {
  return getClient().generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
    state,
  });
};

export default { getGoogleUser, getGoogleAuthUrl };