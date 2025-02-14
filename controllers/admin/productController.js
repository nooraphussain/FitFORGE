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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
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

        const category = Category.find()
        res.render('admin/add-product', {
            category
        })
    } catch (error) {
        res.status(500).send('error while loading product add page')
        res.redirect('/admin.pageError')
    }
}

const addingProduct = async (req, res) => {
    try {
        req.session.admin = true
        console.log('Received body:', req.body);
        console.log('Received files:', req.files);
        
        const products = req.body;
        
        const productExists = await Product.findOne({
            productName: products.productName
        });
        console.log('Product exists?:', productExists);

        if (!productExists) {
            console.log('Processing images...');
            let images = req.files ? req.files.map(file => file.filename) : [];
            console.log('Mapped images:', images);

            // Process images if they exist
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    console.log('Processing image:', i + 1);
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                    
                    // Make sure the directory exists
                    const dir = path.join('public', 'uploads', 'product-images');
                    if (!fs.existsSync(dir)){
                        fs.mkdirSync(dir, { recursive: true });
                    }

                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);
                }
            }

            console.log('Looking for category:', products.category); // Updated to use 'category'
            const categoryId = await Category.findOne({ name: products.category }); // Updated to use 'category'
            console.log('Found category:', categoryId);
            
            if (!categoryId) {
                return res.status(400).json('Invalid category name');
            }

            const sizes = products.productSizes ? JSON.parse(products.productSizes) : [];
            console.log('Parsed sizes:', sizes);

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice, // Updated to use 'regularPrice'
                salePrice: products.salePrice, // Updated to use 'salePrice'
                createdAt: new Date(),
                quantity: products.quantity, // Updated to use 'quantity'
                size: sizes,
                offer: products.offer,
                color: products.color, // Updated to use 'color'
                productImage: images,
                status: 'Available'
            });

            console.log('Attempting to save product:', newProduct);
            await newProduct.save();
            console.log('Product saved successfully');
            req.session.admin = true
            return res.redirect('/admin/products');
        } else {
            return res.status(400).json('Product already exists, please try with another name');
        }
    } catch (error) {
        console.log('Error while saving product:', error);
        console.log('Error stack:', error.stack);
        return res.status(500).json({ error: error.message });
    }
}

const getProducts = async (req, res) => {

    console.log('get request from admin', req.session.admin);
    try {

        if (req.session.admin) {
            
            const search = req.query.search || "";
            const page = parseInt(req.query.page) || 1;
            const limit = 10;
            const skip = (page - 1) * limit;

            const productData = await Product.find({
                productName: { $regex: new RegExp("." + search + ".", "i") }
            })
                .skip(skip)
                .limit(limit)
                .populate('category', 'name') 
                .exec();
            

            const count = await Product.countDocuments({
                productName: { $regex: new RegExp("." + search + ".", "i") }
            });
            
            const category = await Category.find({ isListed: true }, {name: true, _id: false});
        
            if (category) {

                const totalPages = Math.ceil(count / limit);
                
                res.render('admin/products', {
                    data: productData,
                    search: search,
                    data: productData,
                    currentPage: page,
                    totalPages: totalPages,
                    category: category,
                    message:req.flash('success')
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
        const id = req.params.id;
        const product = await Product.findOne({ _id: id }).populate("category");
        const categories = await Category.find(); // Fetch all categories

        if (product) {
            return res.render("admin/edit-product", {
                product: product,
                categories: categories, // Send categories to EJS
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
    const id = req.params.id;
    const {
        productName,
        productDescription,
        productCategory, // Now this should be a valid ObjectId
        regularPrice,
        salePrice,
        quantity,
        color,
        existingImages
    } = req.body;

    try {
        console.log("Product ID:", id);
        console.log("Request Body:", req.body);

        // Validate productCategory as ObjectId
        const mongoose = require("mongoose");
        if (!mongoose.Types.ObjectId.isValid(productCategory)) {
            return res.status(400).json({ message: "Invalid category ID!" });
        }

        // Check if category exists
        const categoryExists = await Category.findById(productCategory);
        if (!categoryExists) {
            return res.status(400).json({ message: "Category does not exist!" });
        }

        // Safely parse existingImages (handle undefined case)
        let parsedImages = [];
        if (existingImages) {
            try {
                parsedImages = JSON.parse(existingImages);
            } catch (error) {
                console.error("Error parsing existingImages:", error);
                return res.status(400).json({ message: "Invalid image data!" });
            }
        }

        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName,
                productDescription,
                category: productCategory, // Store category as an ObjectId
                regularPrice,
                salePrice,
                quantity,
                color,
                existingImages: parsedImages, // Store parsed images safely
            },
            { new: true }
        );

        if (!updatedProduct) {
            return res.status(404).json({ message: "Product not found!" });
        }

        res.redirect('/admin/products')


    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

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



module.exports = {
    addProducts,
    getProducts,
    addingProduct,
    getEditProduct,
    editProduct,
    deleteProduct
}

