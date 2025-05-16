import express from 'express';
import { signup, login, logout, getMe, forgotPassword, resetPassword, rechargeBalance } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);
router.post('/recharge', authenticate, rechargeBalance);

export default router; 