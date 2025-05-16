import nodemailer from 'nodemailer';

// Create a transporter using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_METHOD,
  auth: {
    user: 'opinio079@gmail.com',
    pass: process.env.SMTP_PASSWORD // You'll need to set this in your .env file
  }
  
});


export const sendContactEmail = async (name, email, subject, message) => {
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.mailtrap.io",
      port: parseInt(process.env.SMTP_PORT || "2525"),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Email to the admin (you)
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Opiniofied Contact" <${email}>`,
      to: 'opinio079@gmail.com',
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>From:</strong> ${name} (${email})</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `
    });

    // Auto-reply to the sender
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"Opiniofied" <opinio079@gmail.com>',
      to: email,
      subject: 'Thank you for contacting Opiniofied',
      html: `
        <h2>Thank you for reaching out!</h2>
        <p>Dear ${name},</p>
        <p>We have received your message and will get back to you as soon as possible.</p>
        <p>Here's a copy of your message:</p>
        <hr>
        <p><strong>Subject:</strong> ${subject}</p>
        <p>${message.replace(/\n/g, '<br>')}</p>
        <hr>
        <p>Best regards,</p>
        <p>The Opiniofied Team</p>
      `
    });

    return true;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw new Error('Failed to send email');
  }
};
