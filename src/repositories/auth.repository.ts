import { prisma } from "../prisma/prisma.js";

const findUserByEmail = async (email: string) => {
    return await prisma.user.findUnique({
        where: { email }
    })
}

const findUserByGoogleId = async (googleId: string) => {
    return await prisma.user.findUnique({
        where: { googleId }
    })
}

const createUser = async (name: string, email: string, password: string, googleId?: string) => {
    return await prisma.user.create({
        data: { name, email, password }
    })
}

const createGoogleUser = async (
    name: string,
    email: string,
    googleId: string,
    avatar: string | null
) => {
    return await prisma.user.create({
        data: { name, email, googleId, avatar }
    })
}

// Link Google to an existing email/password account
const linkGoogleAccount = async (id: string, googleId: string, avatar: string | null) => {
    return await prisma.user.update({
        where: { id },
        data: { googleId, ...(avatar ? { avatar } : {}) }
    })
}

const updatePassword = async (id: string, password: string) => {
    return await prisma.user.update({
        where: { id },
        data: { password }
    })
}

const findUserById = async (userId: string) => {
    return await prisma.user.findFirst({
        where: { id: userId }
    })
}

const findUserByRefreshToken = async (refreshToken: string) => {
    return await prisma.user.findFirst({
        where: { refreshToken }
    })
}

const deleteRefreshToken = async (userId: string) => {
    return await prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null, expiresAt: null }
    })
}

const storeRefreshToken = async (userId: string, refreshToken: string, expiresAt: Date) => {
    return await prisma.user.update({
        where: { id: userId },
        data: { refreshToken, expiresAt }
    })
}

export default {
    findUserByEmail,
    findUserByGoogleId,
    createUser,
    createGoogleUser,
    linkGoogleAccount,
    updatePassword,
    findUserById,
    findUserByRefreshToken,
    deleteRefreshToken,
    storeRefreshToken
}