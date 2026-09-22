import { prisma } from "../prisma/prisma.js"

const findUserByEmail = async (email : string) => {
    return await prisma.user.findUnique({
        where: { email }
    })
}

const createUser = async (name: string, email: string, password: string) => {
    return await prisma.user.create({
        data: {
            name: name,
            email: email,
            password: password
        }
    })
}


const updatePassword = async (id: string, password: string) => {
    return await prisma.user.update({
        where : { id },
        data: {
            password: password
        }
    })
}

const findUserById = async (userId : string) => {
    return await prisma.user.findFirst({
        where: { id: userId }
    })
}

const findUserByRefreshToken = async (refreshToken : string) => {
    return await prisma.user.findFirst({
        where : { refreshToken }
    })
}


const deleteRefreshToken = async ( userId : string ) => {
    return await prisma.user.update({
        where : { id : userId },
        data : { refreshToken : null, expiresAt : null }
    })
}


const storeRefreshToken = async ( userId : string, refreshToken : string, expiresAt : Date ) => {
    return await prisma.user.update({ 
        where : { id : userId },
        data : { refreshToken, expiresAt }
    })
};


export default {
    findUserByEmail,
    createUser,
    updatePassword,
    findUserById,
    findUserByRefreshToken,
    deleteRefreshToken,
    storeRefreshToken
}