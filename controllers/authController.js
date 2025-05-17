import User from '../model/user.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import MailtrapClient from 'mailtrap';

// Add daily login bonus
const addDailyLoginBonus = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date().setHours(0, 0, 0, 0);
  const lastLoginDay = new Date(user.lastLogin).setHours(0, 0, 0, 0);

  // Check if it's a new day
  if (today > lastLoginDay) {
    user.balance += 10; // Add 10 rupees daily bonus
    user.lastLogin = new Date();
    await user.save();
  }
};

// Handle video-based recharge
export const rechargeBalance = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add 10 rupees for watching video
    user.balance += 10;
    await user.save();

    res.status(200).json({ 
      message: 'Balance recharged successfully',
      newBalance: user.balance
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Modify the existing login function to include daily bonus
export const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Add daily login bonus
    await addDailyLoginBonus(user._id);
    
    // Get updated user data
    const updatedUser = await User.findById(user._id);
    
    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
        balance: updatedUser.balance,
        lastLogin: updatedUser.lastLogin,
        createdAt: updatedUser.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Register user
export const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Check if user already exists
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const user = new User({
      username,
      email,
      password: hashedPassword,
      balance: 10, // Starting balance
      lastLogin: new Date()
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Set cookie with token
    res.cookie('token', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // Return user data
    res.status(201).json({
      message: 'User registered successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get current user
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      balance: user.balance,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout user
export const logout = async (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/'
  });
  res.status(200).json({ message: 'Logged out successfully' });
};

// Password reset request
export const forgotPassword = async(req, res) => {
  const {username} = req.body;
  
  try{
      const user = await User.findOne({username});
      if(!user){
          return res.status(400).json({success: false, message: 'User not found!'});
      }
      
      const resetToken = crypto.randomBytes(20).toString('hex');
      const resetExpiresAt = Date.now() + 1 * 60 * 60 * 1000; // 1 hr

      user.resetPasswordToken = resetToken;
      user.resetPasswordExpiresAt = resetExpiresAt;
      await user.save();

      // Create reset link
      const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

      try {
          // Fallback to Nodemailer with SMTP if Mailtrap isn't working
          let transportConfig;
          
          // Check which email method to use
          if (process.env.EMAIL_METHOD === 'mailtrap' && process.env.MAILTRAP_TOKEN) {
              console.log("Using Mailtrap for email delivery");
              // Use Mailtrap API
              const client = new MailtrapClient({ 
                  token: process.env.MAILTRAP_TOKEN
              });
              
              if (process.env.MAILTRAP_INBOX_ID) {
                  // Use testing API with inbox ID
                  await client.testing.emails.send(parseInt(process.env.MAILTRAP_INBOX_ID), {
                      from: {
                          email: process.env.EMAIL_FROM || "support@opiniofied.com",
                          name: "Opiniofied Support"
                      },
                      to: [{ 
                          email: user.email 
                      }],
                      subject: "Reset Your Password",
                      text: `You requested a password reset. Click here to reset: ${resetLink}`,
                  });
              } else {
                  throw new Error("Mailtrap inbox ID is required for testing API");
              }
          } else {
              console.log("Using SMTP for email delivery");
              // Fallback to standard SMTP
              transportConfig = {
                  host: process.env.SMTP_HOST || "smtp.mailtrap.io",
                  port: parseInt(process.env.SMTP_PORT || "2525"),
                  auth: {
                      user: process.env.SMTP_USER,
                      pass: process.env.SMTP_PASS
                  }
              };
              
              const transporter = nodemailer.createTransport(transportConfig);
              
              await transporter.sendMail({
                  from: process.env.EMAIL_FROM || '"Opiniofied Support" <support@opiniofied.com>',
                  to: user.email,
                  subject: "Reset Your Password",
                  text: `You requested a password reset. Click here to reset: ${resetLink}`,
                  html: `
                      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                          <h2>Password Reset Request</h2>
                          <p>You recently requested to reset your password for your Opiniofied account.</p>
                          <p>Please click the button below to reset it:</p>
                          <a href="${resetLink}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 20px 0;">Reset Password</a>
                          <p>If you did not request a password reset, please ignore this email or contact support.</p>
                          <p>This link will expire in 1 hour.</p>
                      </div>
                  `
              });
          }

          return res.status(200).json({ success: true, message: "Reset email sent!" });
      } catch (emailError) {
          console.error("Email sending error:", emailError);
          
          // Still save the reset token but inform about email issue
          return res.status(200).json({ 
              success: true, 
              message: "Password reset token generated but email could not be sent. Please check your email configuration.",
              debug: process.env.NODE_ENV === 'development' ? {
                  resetToken: resetToken,
                  error: emailError.message
              } : undefined
          });
      }
      
  } catch(err){
      console.error("Password reset error:", err);
      return res.status(500).json({success: false, message: err.message});
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { newPassword } = req.body;

  try {
      const user = await User.findOne({
          resetPasswordToken: token,
          resetPasswordExpiresAt: { $gt: Date.now() },
      });

      if (!user) {
          return res.status(400).json({ success: false, message: "Invalid or expired token" });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);

      user.password = hashedPassword;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiresAt = undefined;

      await user.save();

      return res.status(200).json({ success: true, message: "Password has been reset" });
  } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
  }
};