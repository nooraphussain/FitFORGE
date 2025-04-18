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
const morgan = require('morgan');
const nocache = require('nocache')

connectDB();

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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


app.use(passport.initialize());
app.use(passport.session());

app.use(morgan('dev'));
app.use(nocache())

app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

app.use(flash());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); 
app.use(express.static(path.join(__dirname, 'public')));
//app.use('/public', express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
    res.locals.baseUrl = ''; 
    next();
});

app.use('/', userRouter);
app.use('/admin', adminRouter);


app.get('/auth/google', passport.authenticate('google', {

    scope: ['profile', 'email']
}));

app.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/'
}), (req, res) => {
    res.redirect(process.env.ClIENT_URL);
});

app.listen(process.env.PORT, () => {
    console.log(`Server started on port ${process.env.PORT}`);
});



module.exports = app;
