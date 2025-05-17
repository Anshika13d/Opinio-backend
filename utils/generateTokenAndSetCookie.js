import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config()

export const generateTokenAndSetCookie = (res, userId) => {
    const token = jwt.sign({ userId}, process.env.JWT_SECRET, {
        expiresIn: '7d' // 1 day
    })

    res.cookie('token', token, {
        httpOnly: true,
        secure: true, // Always use secure cookies
        sameSite: 'none', // Allow cross-site cookie setting
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/' // Ensure cookie is available across all paths
    })

    return token
}