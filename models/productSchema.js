const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: false
    },
    brand: {
        type: String,
        required: false
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    offer:{
        type: String,
        required: false
    },
    isListed: {
        type: Boolean,
        default: true
    },
    quantity: {
        type: Number,
        default: 0
    },
    color: {
        type: String,
        required: false
    },
    productImage: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean, 
        default: false
    },
    status: {
        type: String,
        enum: ['Available', 'out od stock', 'discontinued'],
        required: true,
        default: 'Available',

    }
}, {timestamps: true});

const Product = mongoose.model('Product', productSchema)

module.exports = Product

productSchema.pre('save', async function(next) {
    if (this.isModified('offer') || this.isModified('category') || this.isModified('regularPrice')) {
      try {
        const category = await mongoose.model('Category').findById(this.category);
        const productOffer = parseFloat(this.offer) || 0;
        const categoryOffer = category?.categoryOffer || 0;
        const appliedOffer = Math.max(productOffer, categoryOffer);
        
        this.salePrice = this.regularPrice - (this.regularPrice * appliedOffer / 100);
      } catch (err) {
        return next(err);
      }
    }
    next();
  });