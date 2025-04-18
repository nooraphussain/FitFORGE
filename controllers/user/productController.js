const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Wishlist = require('../../models/wishlistSchema');

const loadProduct = async (req, res) => {
    const productId = req.query.productId;
    const user = req.session.user;
    const userData = await User.findById(user);
    const wishlistData = await Wishlist.findOne({ userId: user }) || { products: [] };
    const wishlist = wishlistData.products.map(item => item.productId.toString()); 

    if (!productId) {
        return res.status(400).send('Product ID is required');
    }

    try {
        const product = await Product.findById(productId)
                 .populate('category', 'name categoryOffer');
        if (!product) {
            return res.status(404).send('Product not found');
        }

        console.log('Category Offer:', product.category?.categoryOffer);
        console.log('Product Offer:', product.offer);
        console.log('Full category data:', product.category);

        // Calculate effective price after applying offers
        let effectivePrice = product.salePrice;
        let appliedOffer = 0;
        
        // Check for product offer
        if (product.offer) {
            appliedOffer = Math.max(appliedOffer, parseInt(product.offer));
        }
        
        // Check for category offer
        if (product.category && product.category.categoryOffer) {
            if (product.category.categoryOffer > appliedOffer) {
                appliedOffer = product.category.categoryOffer;
            }
        }
        
        // Apply the highest offer
        if (appliedOffer > 0) {
            effectivePrice = product.salePrice - (product.salePrice * appliedOffer / 100);
        }
        
        console.log('Applied Offer:', appliedOffer);
        console.log('Effective Price:', effectivePrice);

        // Fetch suggestions: get up to 6 products from the same category that aren't this product
        const suggestions = await Product.find({
            _id: { $ne: productId },
            category: product.category,
            isListed: true
        }).populate('category').limit(6);

        // Process suggestions to include offer calculations
        const processedSuggestions = suggestions.map(suggestion => {
            const plainSuggestion = suggestion.toObject();
            let suggestionEffectivePrice = plainSuggestion.salePrice;
            let suggestionAppliedOffer = 0;
            
            // Check for product offer
            if (plainSuggestion.offer) {
                suggestionAppliedOffer = Math.max(suggestionAppliedOffer, parseInt(plainSuggestion.offer));
            }
            
            // Check for category offer
            if (plainSuggestion.category && plainSuggestion.category.categoryOffer) {
                if (plainSuggestion.category.categoryOffer > suggestionAppliedOffer) {
                    suggestionAppliedOffer = plainSuggestion.category.categoryOffer;
                }
            }
            
            // Apply the highest offer
            if (suggestionAppliedOffer > 0) {
                suggestionEffectivePrice = plainSuggestion.salePrice - (plainSuggestion.salePrice * suggestionAppliedOffer / 100);
                plainSuggestion.effectivePrice = suggestionEffectivePrice;
                plainSuggestion.appliedOffer = suggestionAppliedOffer;
            }
            
            return plainSuggestion;
        });

        res.render('user/product-listing', { 
            product, 
            user: userData, 
            suggestions: processedSuggestions, 
            wishlist,
            effectivePrice,
            appliedOffer 
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};


const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        console.log('productsssss:', product);

        if (!product) {
            return res.status(404).send("Product not found");
        }
        res.render('product', { product }); 
    } catch (error) {
        res.status(500).send("Server Error");
    }
};

const searchProducts = async (req, res) => {
    try {
        const searchQuery = req.query.search;
        const sortOption = req.query.sort;
        const user = req.session.user;
        const userData = await User.findById(user);

        let filter = {};
        if (searchQuery) {
            filter = {
                $or: [
                    { productName: { $regex: searchQuery, $options: "i" } },
                    { brand: { $regex: searchQuery, $options: "i" } }
                ]
            };
        }

        let products = await Product.find(filter).populate('category');
        
        // Process products to calculate effective prices with offers
        products = products.map(product => {
            // Create a plain JavaScript object from the Mongoose document
            const plainProduct = product.toObject();
            
            // Calculate effective price based on offers
            let effectivePrice = plainProduct.salePrice;
            let appliedOffer = 0;
            
            // Check for product offer
            if (plainProduct.offer) {
                appliedOffer = Math.max(appliedOffer, parseInt(plainProduct.offer));
            }
            
            // Check for category offer
            if (plainProduct.category && plainProduct.category.categoryOffer) {
                if (plainProduct.category.categoryOffer > appliedOffer) {
                    appliedOffer = plainProduct.category.categoryOffer;
                }
            }
            
            // Apply the highest offer
            if (appliedOffer > 0) {
                effectivePrice = plainProduct.salePrice - (plainProduct.salePrice * appliedOffer / 100);
                plainProduct.effectivePrice = effectivePrice;
                plainProduct.appliedOffer = appliedOffer;
            }
            
            return plainProduct;
        });

        if (sortOption === "priceLowHigh") {
            products.sort((a, b) => (a.effectivePrice || a.salePrice) - (b.effectivePrice || b.salePrice));
        } else if (sortOption === "priceHighLow") {
            products.sort((a, b) => (b.effectivePrice || b.salePrice) - (a.effectivePrice || a.salePrice));
        } else if (sortOption === "nameAsc") {
            products.sort((a, b) => a.productName.localeCompare(b.productName));
        } else if (sortOption === "nameDesc") {
            products.sort((a, b) => b.productName.localeCompare(a.productName));
        }

        const categories = await Category.find({ isListed: true });

        res.render('user/search-results', { products, user: userData, sortOption, categories });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};


module.exports = {
    loadProduct,
    getProduct,
    searchProducts
};
