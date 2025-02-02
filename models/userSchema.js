const mongoose = require('mongoose');
const {Schema} = require('mongoose')

//userSche ma is a schema definition used in databases (typically MongoDB) to define the structure, 
//validation rules, and behavior of documents in a collection that stores user data.

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String, // Corrected 'email' to String type
        required: true,
        unique: true, // Ensures no duplicate emails in the database
    },
    phoneNumber: {
        type: String,
        required: false,
        sparse: true,
        default: null
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    }, 
    googleId: {
        type: String,
        unique: true
    },
    isActive: {
        type: Boolean,
        default: true 
    },
    isAdmin: {
        type: Boolean,
        default: false 
    },
    cart: [{
        type: Schema.Types.ObjectId,
        ref: 'Cart'
    }],
    wallet: [{
        type: Number,
        defalut: 0,

    }],
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: 'wishlist'
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: 'Order'
    }],
    createdAt: {
        type: Date,
        default: Date.now 
    },
    updatedAt: {
        type: Date,
        default: Date.now 
    },
    referralCode: {
        type: String
    },
    redeemed: {
        type: Boolean 
    },
    redeemedUsers: {
        type: Schema.Types.ObjectId,
        ref: "User"
    },
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category "
        },
        brand: {
            type: String
        }, 
        searchOn: {
            type: Date,
            default: Date.now
        }  
    }]
});

// Create a model from the schema
const User = mongoose.model('User', userSchema);

module.exports = User;


 