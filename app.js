const express = require('express');
const app = express();
const session = require('express-session');
const passport = require('./config/passport');
const cors = require('cors');
// const cookeieSession = require('cookie-session')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const env = require('dotenv').config();
const { connectDB } = require('./config/db');
const path = require('path');
const userRouter = require('./routes/userRouter');
const adminRouter = require('./routes/adminRouter');
const flash = require('connect-flash');

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


app.use(
  cors({
    origin: "http://localhost:2006", 
    credentials: true,
  })
);


// Initialize passport
app.use(passport.initialize());
app.use(passport.session());


// Middleware to parse JSON data
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(flash());

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
    res.redirect(process.env.ClIENT_URL);
});


// Start the server
app.listen(process.env.PORT, () => {
    console.log(`Server started on port ${process.env.PORT}`);
});

module.exports = app;
