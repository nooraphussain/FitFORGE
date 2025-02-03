const express = require('express');
const app = express();
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const env = require('dotenv').config();
const { connectDB } = require('./config/db');
const path = require('path');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');

// Connecting to the database
connectDB();

// Setting up session for user authentication
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 72 * 60 * 60 * 1000,
    }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware to parse JSON data
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

// Passport Google Strategy Configuration
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback",  // Adjust this if your environment differs
}, (accessToken, refreshToken, profile, done) => {
    // You can store the profile or user info in the session here
    return done(null, profile);
}));

// Serialize and Deserialize user to maintain session
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((user, done) => {
    done(null, user);
});

// Set up view engine and views directory
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Setting views directory to the parent 'views' folder
app.use(express.static('public'));

// Routes
app.use('/', userRouter);
app.use('/admin', adminRouter);

// Authentication Routes for Google
app.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

app.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/'
}), (req, res) => {
    // Successful authentication, redirect to index or dashboard
    res.redirect('/index');
});

// Start the server
app.listen(process.env.PORT, () => {
    console.log(`Server started on port ${process.env.PORT}`);
});

module.exports = app;
