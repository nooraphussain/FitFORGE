const path = require('path')
const fs = require('fs')
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const User = require('../../models/userSchema')
const sharp = require('sharp');
const multer = require('multer');
const flash = require('connect-flash');


const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'public/uploads/products');
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  

  const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, 
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Not an image! Please upload images only.'), false);
      }
    }
  });


const addProducts = async (req, res) => {
    try {
        const categories = await Category.find().select("name categoryOffer _id");
        res.render('admin/add-product', {
            categories
        })
    } catch (error) {
        res.status(500).send('error while loading product add page')
        res.redirect('/admin.pageError')
    }
}


const addingProduct = async (req, res) => {
    try {
        req.session.admin = true;
        console.log('Received body:', req.body);
        console.log('Received files:', req.files);
        
        const products = req.body;

        console.log('products name:: ', products.productName);
        
        
        const productExists = await Product.findOne({
            productName: products.productName
        });
        console.log('Product exists?:', productExists);

        if (productExists) {
            return res.status(400).json({ success: false, message: 'Product already exists, please try with another name' });
        }

        console.log('Processing images...');
        let images = req.files ? req.files.map(file => file.filename) : [];
        console.log('Mapped images:', images);

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                console.log('Processing image:', i + 1);
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                
                const dir = path.join('public', 'uploads', 'product-images');
                if (!fs.existsSync(dir)){
                    fs.mkdirSync(dir, { recursive: true });
                }

                await sharp(originalImagePath)
                    .resize({ width: 440, height: 440 })
                    .toFile(resizedImagePath);
            }
        }

        console.log('Looking for category:', products.productCategory); 
        const categoryId = await Category.findOne({ _id: products.productCategory }); 
        console.log('Found category:', categoryId);

        
        if (!categoryId) {
            return res.status(400).json({ error: 'Invalid category name' });
        }

        const sizes = products.productSizes ? JSON.parse(products.productSizes) : [];
        console.log('Parsed sizes:', sizes);

        // Get the category offer
        const categoryOffer = categoryId.categoryOffer || 0;
        const productOffer = products.offer ? parseFloat(products.offer) : 0;
        
        // Apply the larger of product and category offers
        const appliedOffer = Math.max(productOffer, categoryOffer);
        
        // Calculate sale price based on the applied offer
        let salePrice = products.salePrice;
        if (appliedOffer > 0) {
            salePrice = (products.regularPrice - (products.regularPrice * appliedOffer / 100)).toFixed(2);
        }

        const newProduct = new Product({
            productName: products.productName,
            description: products.description,
            category: categoryId._id,
            brand: products.brand,
            regularPrice: products.regularPrice,
            salePrice: salePrice,
            createdAt: new Date(),
            quantity: products.quantity,
            size: sizes,
            offer: products.offer,
            color: products.color,
            productImage: images,
            status: 'Available'
        });

        console.log('Attempting to save product:', newProduct);
        await newProduct.save();
        console.log('Product saved successfully');
        
        req.session.admin = true;
        return res.status(200).json({ success: true, message: 'Product added successfully' });

    } catch (error) {
        console.log('Error while saving product:', error);
        console.log('Error stack:', error.stack);
        return res.status(500).json({ error: error.message });
    }
};


const getProducts = async (req, res) => {
    try {
        if (req.session.admin) {
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            const productData = await Product.find({
                productName: { $regex: new RegExp("." + search + ".", "i") }
            })
                .sort({ _id: -1 })
                .skip(skip)
                .limit(limit)
                .populate('category', 'name categoryOffer') // Include categoryOffer in population
                .exec();
            
            const count = await Product.countDocuments({
                productName: { $regex: new RegExp("." + search + ".", "i") }
            });
            
            const category = await Category.find({ isListed: true }, {name: true, categoryOffer: true, _id: false});
        
            if (category) {
                const totalPages = Math.ceil(count / limit);
                
                // Calculate applied offers and update sale prices
                productData.forEach(product => {
                    const productOffer = product.offer ? parseFloat(product.offer) : 0;
                    const categoryOffer = product.category && product.category.categoryOffer ? parseFloat(product.category.categoryOffer) : 0;
                    const appliedOffer = Math.max(productOffer, categoryOffer);
                    
                    // Add the applied offer to the product object for display
                    product.appliedOffer = appliedOffer;
                    
                    // Update sale price based on applied offer if needed
                    if (appliedOffer > 0) {
                        const calculatedSalePrice = product.regularPrice - (product.regularPrice * appliedOffer / 100);
                        if (product.salePrice !== calculatedSalePrice) {
                            product.salePrice = calculatedSalePrice.toFixed(2);
                        }
                    }
                });
                
                res.render('admin/products', {
                    data: productData,
                    search: search,
                    currentPage: page,
                    totalPages: totalPages,
                    category: category,
                    message: req.flash('success')
                });
            } else {
                res.render('page-404');
            }
        }
    } catch (error) {
        console.error('Pagination Error:', error);
        res.redirect('/admin/pageError');
    }
}

const getEditProduct = async (req, res) => {
    try {
        if (!req.session.admin) {
            return res.redirect('/admin/login')
        }
        const id = req.params.id;
        const product = await Product.findOne({ _id: id }).populate("category", "name categoryOffer _id");
        const categories = await Category.find().select("name categoryOffer _id"); 

        if (product) {
            // Calculate the applied offer
            const productOffer = product.offer ? parseFloat(product.offer) : 0;
            const categoryOffer = product.category && product.category.categoryOffer ? parseFloat(product.category.categoryOffer) : 0;
            const appliedOffer = Math.max(productOffer, categoryOffer);
            
            // Add the applied offer to the product object for display
            product.appliedOffer = appliedOffer;
            
            // Update sale price based on applied offer
            if (appliedOffer > 0) {
                const calculatedSalePrice = product.regularPrice - (product.regularPrice * appliedOffer / 100);
                product.salePrice = calculatedSalePrice.toFixed(2);
            }
            
            return res.render("admin/edit-product", {
                product: product,
                categories: categories,
                pageTitle: "Edit Product",
                path: "/admin/products",
            });
        }
        res.redirect("/admin/products");
    } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).redirect("/admin/products");
    }
};


const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { productName, productCategory, regularPrice, salePrice, quantity, color, offer, deletedImages } = req.body;
        
        // Get current product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).send('Product not found');
        }
        
        // Get current images
        let currentImages = [...product.productImage];
        
        // Process deleted images
        if (deletedImages && deletedImages.length > 0) {
            const deletedIndices = Array.isArray(deletedImages) ? deletedImages : [deletedImages];
            
            // Remove images at the specified indices (in reverse to avoid index shifting)
            deletedIndices.sort((a, b) => b - a).forEach(index => {
                currentImages.splice(index, 1);
            });
        }
        
        // Process new images
        if (req.files && req.files.length > 0) {
            const newImages = req.files.map(file => file.filename);
            currentImages = [...currentImages, ...newImages];
        }
        
        // Validate minimum image count
        if (currentImages.length < 3) {
            return res.status(400).send('Products must have at least 3 images');
        }
        
        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                productName,
                category: productCategory,
                regularPrice,
                salePrice,
                offer,
                quantity,
                color,
                productImage: currentImages
            },
            { new: true }
        );
        
        res.redirect('/admin/products');
    } catch (error) {
        console.log('Error editing product:', error);
        res.redirect('/admin/pageError');
    }
};


const deleteImage = async (req, res) => {
    try {
        const { productId, imageIndex } = req.params;
        
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        
        // Validate minimum image count
        if (product.productImage.length <= 3) {
            return res.status(400).json({ message: 'Products must have at least 3 images' });
        }
        
        // For AJAX requests: just return success, actual deletion happens on form submit
        return res.status(200).json({ message: 'Image deleted successfully' });
    } catch (error) {
        console.error('Error deleting image:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};

const blockProduct = async (req, res) => {
    try {
        let id = req.query.id
        await Product.updateOne({_id: id}, {$set: {isBlocked: true}})
        res.redirect('/admin/products')

    } catch (error) {
        res.redirect('pageError')
    }
}

const unblockProduct = async (req, res) => {
    try {
        let id = req.query.id
        await Product.updateOne({_id: id}, {$set: {isBlocked: false}})
        res.redirect('/admin/products')

    } catch (error) {
        res.redirect('pageError')
    }
}

const deleteProduct = async (req, res) => {

    console.log('delting product');
    
    try {

        const productId = req.query.id
        const deleteProduct = await Product.findByIdAndDelete(productId, {
            new: true
        })

        if (deleteProduct) {
            return res.redirect('/admin/products')
        }

    } catch (error) {
        console.log('Error while delteing the product', error);
        res.redirect('/admin/pageError')
        
    }
}

const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        
        if (!productId || !percentage) {
            return res.status(400).json({ status: false, message: 'Product ID and percentage are required' });
        }
        
        const product = await Product.findById(productId).populate('category', 'categoryOffer');
        
        if (!product) {
            return res.status(404).json({ status: false, message: 'Product not found' });
        }
        
        // Update product offer
        product.offer = percentage;
        
        // Calculate the new sale price based on the larger of product and category offers
        const categoryOffer = product.category && product.category.categoryOffer ? parseFloat(product.category.categoryOffer) : 0;
        const appliedOffer = Math.max(parseFloat(percentage), categoryOffer);
        
        product.salePrice = (product.regularPrice - (product.regularPrice * appliedOffer / 100)).toFixed(2);
        
        await product.save();
        
        return res.status(200).json({ status: true, message: 'Offer updated successfully' });
    } catch (error) {
        console.error('Error adding product offer:', error);
        return res.status(500).json({ status: false, message: 'Internal server error' });
    }
};

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;
        
        if (!productId) {
            return res.status(400).json({ status: false, message: 'Product ID is required' });
        }
        
        const product = await Product.findById(productId).populate('category', 'categoryOffer');
        
        if (!product) {
            return res.status(404).json({ status: false, message: 'Product not found' });
        }
        
        // Remove product offer
        product.offer = 0;
        
        // Calculate the new sale price based on category offer if it exists
        const categoryOffer = product.category && product.category.categoryOffer ? parseFloat(product.category.categoryOffer) : 0;
        
        if (categoryOffer > 0) {
            product.salePrice = (product.regularPrice - (product.regularPrice * categoryOffer / 100)).toFixed(2);
        } else {
            // If no offers, sale price equals regular price
            product.salePrice = product.regularPrice;
        }
        
        await product.save();
        
        return res.status(200).json({ status: true, message: 'Offer removed successfully' });
    } catch (error) {
        console.error('Error removing product offer:', error);
        return res.status(500).json({ status: false, message: 'Internal server error' });
    }
};


module.exports = {
    addProducts,
    getProducts,
    addingProduct,
    getEditProduct,
    editProduct,
    deleteImage,
    blockProduct,
    unblockProduct,
    deleteProduct,
    addProductOffer,
    removeProductOffer
}