const express = require('express')
const router = express.Router()
  const userController = require('../controllers/user/userController')
const { route } = require('../app')
const passport = require('passport')
  

router.get('/', userController.loadHomePage)
router.get('/pageNotFound', userController.pageNotFound)
router.get('/login', userController.loadLogin)  
router.post('/login', userController.login)


router.get('/signup', userController.loadSignup)
router.post("/signup", userController.signUp);
router.post("/verify-otp", userController.verifyOtp);

router.post('/resend-otp', userController.resendOtp)
router.post('/otp-verified', userController.otpVerified)
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);


router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/signup'}), 
    (req, res) => {
        // Redirect user to home on successful authentication
        req.session.user = req.user._id
        res.redirect('/');
    }
);

router.get('/forgot-password', userController.loadForgotPassword)
router.post('/forgot-otp', userController.forgotPassword)
router.post('/reset-password', userController.resetPassword)
router.post('/reset-password-verify', userController.resetVerify)


// router.get('*', userController.pageRedirect)

module.exports = router