const User = require('../../models/userSchema')
const bcrypt = require('bcrypt')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const Product = require('../../models/productSchema')


const loadHomePage = async (req, res) => {
    console.log('worked');

    try {
        // Fetch products from the database
        const products = await Product.find({ isListed: true });

        res.render('user/index', { data: products }); // Now you're passing 'data'
    } catch (error) {
        console.log('Home page not found!', error);
        res.status(500).send('Server error!');
    }
};


const loadSignup = (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/shop')
        }

        return res.render('user/signup', {msg: null})
    } catch (error) {
        res.status(500).send('Error while loading signup page', err)
    }
} 


const pageNotFound = (req, res) => {
    try {
        return res.render('error');  
    } catch (error) {
        console.log('Error loading error page', error);
        res.status(500).send('Error while loading error page');
    }
}

const pageRedirect = (req, res) => {
    res.redirect('/pageNotFound')
}

const loadLogin = (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect('/shop')
        }
        res.render('user/login', { message: null })
    } catch (error) {
        console.error('Error while loading login page:', error);
        res.status(500).send('Error while loading the login page');
    }
}


const login = async (req, res) => {
    try {
        const {email, password} = req.body
        const findUser = await User.findOne({isAdmin: 0, email: email})

        if (!findUser) {
            return res.render('user/login', {message: 'User not found!'})
        }

        if (findUser.isBlocked) {
            return res.render('user/login', {message: 'User is blocked by admin'})
        }

        console.log('user values', findUser);


        const passwordMatch = await bcrypt.compare(password, findUser.password)

        if (!passwordMatch) {
            console.log('Password is not match');
            
            return res.render('user/login', {message: 'Incorrect password'})
        }

        req.session.user = findUser._id 
        console.log(req.session.user);
        res.redirect('/shop')


    } catch (error) {
        
        console.error('login error', error);
        res.render('user/login', {message: 'login failed. Please try again later'})
    }
}



const logout = async (req, res) => {
    try {
        req.session.user = undefined 
        req.session.userData = undefined
        res.redirect('/')
    } catch (error) {
        console.log('Logout error', error);
        res.redirect('/pageNotFound')
    }
}

function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendVerificationEmail(email, otp) {
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        })


        const info = await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your account',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP is ${otp} </b>`,

        })

        console.log('otp succesffully sent ', otp);
        

        return info.accepted.length > 0

    } catch (error) {
        console.log('Error sending email', error);
        return false
    }
}

const signUp = async (req, res) => {
    try {

        const {fullName, phone, email, password, confirmPassword} = req.body

        console.log('user datas', req.body);
        

        const findUser = await User.findOne({email}) 
        console.log(findUser);
        console.log(req.body);
        
        if (findUser) {
            return res.render('user/signup', {msg: 'email is already existed'})
        }

        const otp = generateOtp()

        const emailSent = await sendVerificationEmail(email, otp)
        if (!emailSent) {
            return res.json('email-error')
        }

        req.session.otp = otp

        if (!req.session.userData) {
            req.session.userData = {fullName, phone, email, password}
        }

        console.log('session data: ', req.session.userData);     

        res.render('user/verify-otp', {otp: otp, timer: 60, email: email})
        console.log('OTP sent', otp);
        

     } catch (error) {

        console.log('Signup error', error);
        res.redirect('/pageNotFound')

     }


}

const otpVerified = async (req, res) => {

    try {

        const {fullName, phone, email, password} = req.session.userData

        const pass = await securePassword(password)


        const newUser = new User({
            name: fullName,        
            email: email,          
            password: pass,       
            phoneNumber: phone,
            googleId: generateOtp()
        })
        
        await newUser.save()

        const user = await User.findOne({email: email})

        req.session.user = user._id

        res.status(200).json({ success: true, message: 'Signup successful!' })

    } catch (error) {

        console.log(error);
        
        res.status(500).send('error while saving the data into the database')
    }
}


const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {
        console.log('error while securing the password');
    }
}

function randomId() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

const verifyOtp = async (req, res) => {
    try {
        const {otp} = req.body
        console.log(otp);

        if (otp === req.session.otp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)
            const random = randomId()
            const saveUserData=  new User({
                name: user.fullName,
                email: user.email,
                phoneNumber: user.phone,
                password: passwordHash,
                googleId: random
            })
            
            await saveUserData.save()
            req.session.userData = saveUserData._id
            res.json({success: true, redirectUrl: '/'})

        } else {
            res.status(400).json({success: false, message: 'Invalid OTP, Please try again'})
        }
        
    } catch (error) {
        console.log('Error while verifying otp', error);
        res.status(500).json({success: false, message: 'An error occured'})
    }
}

const resendOtp = async (req, res) => {
    try {
        
        const {email} = req.session.userData
        if (!email) {
            return res.status(400).json({success: false, message: 'Email not found in session'})
        }

        const otp = generateOtp()
        req.session.userOtp = otp

        const emailSent = await sendVerificationEmail(email, otp)

        if (emailSent) {
            console.log('Resend otp', otp);
            res.status(200).json({success: true, message: 'OTP resend Successfully'})
        } else {
            res.status(500).json({success: false, message: 'Falied to resend OTP. Please try again later'})
        }

    } catch (error) {

        console.error('Error while sending otp', error);
        res.status(500).json({success: false, message: 'Internal Server error! please try again later'})
    }
}

const loadForgotPassword = (req, res) => {
    try {
        res.render('user/forgot-password', {msg: null})
    } catch (error) {
        res.status(500).send('error while loading forgot password section')
    }
}

const forgotPassword = async (req, res) => {

    try {
        const { email, resendOtpValue } = req.body

        if (resendOtpValue) {
            const otp = generateOtp()
            await sendVerificationEmail(email, otp)
            return res.render('user/forgot-otp', {timer: 60, otp: otp, email: email})

        }
        
        const user = await User.findOne({email: email})
        
        if (!user) {
            res.render('user/forgot-password', {msg: 'user not found!'})
        } else {

            const otp = generateOtp()
            await sendVerificationEmail(email, otp)
            req.session.userCheck = user
            res.render('user/forgot-otp', {timer: 60, otp: otp, email: email});

        }
        
    } catch (error) {
        res.status(500).send('error while posting data into forgot password')
    }
}

const resetPassword = async (req, res) => {
    const { email } = req.query;

    try {
        if (req.session.userCheck) {
            return res.render('user/reset-password', { msg: null, email: email });
        }

        res.redirect('/')
        
    } catch (error) {
        res.status(500).send('error while loading the reset password section');
    }
}

const resetVerify = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        
        // Check if the damn user exists
        const user = await User.findOne({ email: email });
        if (!user) {
            return res.status(400).send('user not found');
        }
        
        const pass = await securePassword(newPassword);
        console.log("Hashed Password:", pass);
        
        // Update the password using findOneAndUpdate for that extra precision
        const updatedPassword = await User.findOneAndUpdate(
            { email: email },
            { $set: { password: pass } },
            { new: true }
        );
        
        if (updatedPassword) {
            return res.redirect('/login');
        } else {
            console.log("password not updated");
            return res.status(400).send('password update failed');
        }
    } catch (error) {
        res.status(500).send('error happened while resetting password');
    }
}


const loadShop = async (req, res) => {
    try {
        const user = req.session.user
        if (req.session.user) {
            // Fetch products from the database
            const products = await Product.find({ isListed: true });


            return res.render('user/shop', {
                data: products,

            });
        }
        res.redirect('/');
    } catch (error) {
        console.error('Error while loading the shop section:', error);
        res.status(500).send("Internal Server Error");
    }
};

const loadProduct = (req, res) => {
    const productId = req.query.productId;
    
    
    if (!productId) {
        return res.status(400).send('Product ID is required');
    }

    // Fetch product details from database
    Product.findById(productId)
        .then(product => {
            if (!product) {
                return res.status(404).send('Product not found');
            }
            res.render('user/product-listing', { product });
        })
        .catch(err => {
            console.error(err);
            res.status(500).send('Server Error');
        });
};

const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        console.log('productsssss:', product);
        
        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render('product', { product }); // Sending product data to EJS
    } catch (error) {
        res.status(500).send("Server Error");
    }
}

const getContactPage = (req, res) => {
    res.render('user/contact'); 
};



module.exports = {
    loadHomePage, 
    pageNotFound,
    pageRedirect,
    loadSignup,
    loadLogin,
    signUp,
    verifyOtp,
    resendOtp,
    login,
    logout,
    loadForgotPassword,
    forgotPassword,
    resetPassword,
    resetVerify,
    otpVerified,
    loadShop,
    loadProduct,
    getProduct,
    getContactPage
}