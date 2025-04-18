const User = require('../models/userSchema')

const userAuth = (req, res, next) => {
    if (req.session.user) {
        User.findById(req.session.user)
        .then((data) => {
            if (data && !data.isBlocked) {
                next()
            } else {
                // res.redirect('/login')
                req.session.destroy((err) => {
                    if (err) {
                        console.log('Error destroying session', err);
                    }
                    res.redirect('/login');
                });
            }
        })
        .catch((error) => {
            console.log('Error happened while authenticating user by using middleware', error);
            res.status(500).send('Internal Server Error!')
        })
    } else {
        res.redirect('/login')
    }
}

const adminAuth = (req, res, next) => {
    
    if (req.session.admin) {
        next()
    } else {
        res.redirect('/admin/login')
    }
}

module.exports = {
    adminAuth,
    userAuth
}