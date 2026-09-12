import JWT from 'jsonwebtoken';

declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: string;
                exp?: number;
            };
        }
    }
}

// Ensure secrets are defined
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

if (!accessTokenSecret || !refreshTokenSecret) {
    throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be defined in environment variables');
}

const generateAccessToken = (userId: string) => {
    return JWT.sign(
        { userId },
        accessTokenSecret,
        { expiresIn: '1h' }
    );
};

const generateRefreshToken = (userId: string) => {
    return JWT.sign(
        { userId  },
        refreshTokenSecret,
        { expiresIn: '8h' }
    );
};

export { generateAccessToken, generateRefreshToken };