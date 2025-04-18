const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/productController')
const cartController = require('../controllers/user/cartContoller')
const profileController = require('../controllers/user/profileController')
const addressController = require('../controllers/user/addressController')
const checkoutController = require('../controllers/user/checkoutController')
const orderController = require('../controllers/user/orderController')
const cancellationController = require('../controllers/user/cancellationController')
const wishlistController = require('../controllers/user/wishlistController')
const couponController = require('../controllers/user/couponController')
const walletController = require('../controllers/user/walletController')
const referralController = require("../controllers/user/referralController")
const { route } = require('../app')
const passport = require('passport')
const {userAuth} = require('../middlewares/auth')
  


router.get('/pageNotFound', userController.pageNotFound)
router.get('/login', userController.loadLogin)  
router.post('/login', userController.login)
router.get('/', userController.loadHomePage);
router.get('/shop',userAuth, userController.loadShop);
router.get('/logout', userController.logout)

router.get('/signup', userController.loadSignup)
router.post("/signup", userController.signUp);
router.post("/verify-otp", userController.verifyOtp);

router.post('/resend-otp', userController.resendOtp)
router.post('/otp-verified', userController.otpVerified)
router.get('/auth/google', 
    passport.authenticate('google', { scope: ['profile', 'email'] })
);



router.get('/contact', userController.getContactPage);

router.get('/auth/google/callback', 
    passport.authenticate('google', { failureRedirect: '/signup'}), 
    (req, res) => {
        req.session.user = req.user._id
        res.redirect('/');
    }
);

//Product Management
router.get('/product-listing', productController.loadProduct);
router.get('/product-listing/:id', productController.getProduct);
router.get('/search', productController.searchProducts);


//User management
router.get('/forgot-password', userController.loadForgotPassword)
router.post('/forgot-otp', userController.forgotPassword)
router.get('/reset-password', userController.resetPassword)
router.post('/reset-password-verify', userController.resetVerify)


// Profile update
router.get("/account",userAuth,profileController.loadAccount)
router.post('/account/edit', profileController.editAccount);
//OTP & Email Change
router.post('/resend-otp',profileController.resendOtp)
router.post('/newEmail-verify', profileController.verifyOtp)
router.patch('/saveEmail', profileController.updateEmail)
router.post('/newMobile-verify', profileController.verifyMobileOtp);
router.patch('/saveMobile', profileController.updateMobile);
//.post('/update-profile', profileController.updateProfile)


// Address Management
router.get("/account/addresses", userAuth, addressController.manageAddresses);
router.post("/account/addresses", userAuth, addressController.postAddressAction);

// Cart Management
router.get("/cart", userAuth, cartController.loadCartPage);
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/cart", userAuth, cartController.updateCartItem);
router.delete("/deleteItem", userAuth, cartController.removeCartItem);
router.get('/cart-logout', cartController.loadCartLogout )

//Wishlist management
router.get("/wishlist",userAuth,wishlistController.loadWishList)
router.post("/addToWishlist",userAuth,wishlistController.addToWishList)
router.post("/wishlist/remove", userAuth, wishlistController.removeFromWishlist);

// Checkout Management
router.get("/checkout", userAuth, checkoutController.getCheckoutPage)
router.get("/payment", userAuth, checkoutController.loadPayment)
router.put("/cart/update/:productId", checkoutController.updateCartItem)
router.delete("/cart/remove/:productId", checkoutController.removeCartItem)
router.post("/verify-payment", userAuth, checkoutController.verifyPayment)
router.get("/payment-fail", userAuth, checkoutController.paymentFailed)
router.get("/checkout/retry/:id", userAuth, checkoutController.retryPayment)
router.get("/orderDetails-failed", userAuth, checkoutController.OrderDetailFailPage)
router.get("/orderDetails-failed/:id", userAuth, orderController.loadFailedOrderDetails)
router.post('/removeCoupon',userAuth, checkoutController.removeCoupon);

// Order Management
router.get("/orderPlaced", userAuth, orderController.orderPlacedPage)
router.post("/orderPlaced", userAuth, checkoutController.orderPlaced)
router.get("/account/orders", userAuth, orderController.loadOrders)
router.get("/account/orderDetails/:id", userAuth, orderController.loadOrderDetails)
router.get("/order-success", userAuth, orderController.orderSuccessPage);

//Cancellation Management
router.post('/cancel-item/:orderId', userAuth, cancellationController.cancelOrder); 
router.post("/orderCancel/:orderId", userAuth, cancellationController.orderCancel);
router.post("/orders/:orderId/cancel", userAuth, cancellationController.finalizeCancellation);
router.get('/orders/:orderId/cancel', userAuth, cancellationController.renderCancellationReasonPage);
router.post("/return-item/:orderId", userAuth, cancellationController.submitReturnRequest);
router.post('/process-return-refund', userAuth, cancellationController.processReturnRefund);

//Coupon Management
router.post('/applyCoupon',userAuth, couponController.applyCoupon);

// Wallet Management
router.get('/account/wallet', userAuth, walletController.loadWallet);
router.post('/wallet/create-order', userAuth, walletController.createWalletOrder);
router.post('/wallet/verify-payment', userAuth, walletController.verifyWalletPayment);
router.post('/wallet/process-payment', userAuth, walletController.processWalletPayment);
router.get('/wallet/balance', userAuth, walletController.getWalletBalance);

//Referral Management
router.get("/account/referrals", userAuth, referralController.loadReferrals)
router.post("/apply-referral", referralController.applyReferralCode)
router.post("/redeem-referrals", userAuth, referralController.redeemReferralEarnings)


module.exports = router