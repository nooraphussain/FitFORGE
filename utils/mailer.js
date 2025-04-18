const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,  // Your Gmail
        pass: process.env.EMAIL_PASS,  // Your App Password
    },
});

const sendVerificationEmail = async (email, otp) => {
    try {
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: "Your OTP Code",
            text: `Your OTP code is: ${otp}. It is valid for 10 minutes.`,
        };

        await transporter.sendMail(mailOptions);
        console.log("OTP sent successfully to:", email);
        return true;
    } catch (error) {
        console.error("Error sending OTP:", error);
        return false;
    }
};

module.exports = sendVerificationEmail;
