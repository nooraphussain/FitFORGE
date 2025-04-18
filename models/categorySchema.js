const mongoose = require('mongoose');
const { Schema } = mongoose;

const categorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    },
    offerPrice:{
        type: String,
        required:false
    },
    isListed: {
        type: Boolean,
        default: true
    },
    isAdded:{
        type: Boolean,
        default: true
    },
    categoryOffer: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Category = mongoose.model('Category', categorySchema)

module.exports = Category 


categorySchema.post('save', async function(doc) {
    try {
      const Product = mongoose.model('Product');
      const products = await Product.find({ category: doc._id });
      
      await Promise.all(products.map(product => product.save()));
    } catch (err) {
      console.error('Error updating related products:', err);
    }
  });