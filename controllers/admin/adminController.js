const User = require('../../models/userSchema')
const mongoose = require('mongoose')
const bycrypt = require('bcrypt')


const loadLogin = async (req, res) => {
    if (req.session.admin) {
        return res.redirect('/admin/dashboard');
    }
    res.render('admin/admin-login', { message: null }); 

}


const login = async (req, res) => {

    try {
        
        const {email, password} = req.body       
        const admin = await User.findOne({email, isAdmin: true})

        if (admin) {

            const passwordMatch = bycrypt.compare(password, admin.password)

            if (passwordMatch) {

                req.session.admin = true
                return res.redirect('/admin')

            } else {
                return res.redirect('/login')
            }
        } else {
            return res.redirect('/admin/login')
        }

    } catch (error) {
        
        console.log('login error', error);
        return res.redirect('/pageError')

    }
}


const loadDashboard = async (req, res) => {
    try {
        if (req.session.admin) {
            res.render('admin/dashboard');
        } else {
            return res.redirect('/admin/login');  // Redirect if not authenticated
        }
    } catch (error) {
        console.log('Error while loading dashboard:', error);
        return res.redirect('/admin/pageError');
    }
};


const pageError = (req, res) => {
    res.render('admin-error')
}

const logout = (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log('Error while destrying session', err);
                return res.redirect('/pageError')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.log('Un expected error during logout', error);
        res.redirect('/admin/pageError')
    }
}


module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
}