const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    address: [{
        addressType: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        city: {
            type: String,
            required: true
        },
        addressLine: {            
            type: String,
            required: true
        },
        landmark: {
            type: String,
            required: false
        },
        state: {
            type: String,
            required: true
        },
        pincode: {
            type: Number,
            required: true
        },
        phone: {
            type: Number,
            required: true
        },
        altPhone: {
            type: Number,
            required: false
        }
    }]
});

const Address = mongoose.model('Address', addressSchema)

module.exports = Address