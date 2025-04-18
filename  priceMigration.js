require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('./models/productSchema');
const Category = require('./models/categorySchema');

const migratePrices = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    const products = await Product.find().populate('category');
    
    let count = 0;
    for (const product of products) {
      await product.save();
      count++;
      console.log(`Updated product ${count}/${products.length}: ${product.productName}`);
    }
    
    console.log('\nMigration completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
};

migratePrices();