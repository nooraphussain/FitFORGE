const Product = require('../../models/productSchema')
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
const Wishlist = require('../../models/wishlistSchema');
const mongoose = require('mongoose');


const loadWishList = async (req, res) => {
    try {
        const userId = req.session.user;
        if (!userId) {
            return res.redirect("/login");
        }

        const wishlist = await Wishlist.findOne({ userId }).populate({
            path: "products.productId",
            model: "Product",
            select: "productName productImage brand salePrice regularPrice offer description color", // 👈 Selecting all necessary fields
        });

        let products = [];
        if (wishlist && wishlist.products.length > 0) {
            products = wishlist.products
                .filter(item => item.productId) // Ensure the product exists
                .map(item => ({
                    productId: item.productId._id.toString(), // Convert to string for consistency
                    productName: item.productId.productName,
                    productImage: item.productId.productImage[0] || "default.jpg",
                    brand: item.productId.brand || "Unknown", 
                    salePrice: item.productId.salePrice || 0, 
                    regularPrice: item.productId.regularPrice || 0, 
                    offer: item.productId.offer || "No discount", 
                    description: item.productId.description || "No description",
                    color: item.productId.color || "#ffffff", 
                    addedOn: item.addedOn,
                }));
        }

        const userData = await User.findById(userId);

        res.render("user/wishlist", { 
            products,
            user: userData 
        });

    } catch (error) {
        console.error("Error while loading the wishlist:", error);
        res.redirect("/pageNotFound");
    }
};

const addToWishList = async (req, res) => {
    try {
        const userId = req.session.user;
        const { productId } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        const isProductInWishlist = wishlist.products.some(item => item.productId.toString() === productId);

        if (isProductInWishlist) {
            return res.status(200).json({ success: false, message: "Product already in wishlist" });
        }

        wishlist.products.push({ productId });
        await wishlist.save();

        return res.status(200).json({ success: true, message: "Added to wishlist!" });

    } catch (error) {
        console.error("❌ Error while adding product to wishlist:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId = req.session.user;

        if (!userId) {
            return res.status(401).json({ success: false, message: "User not logged in" });
        }

        if (!productId) {
            return res.status(400).json({ success: false, message: "Invalid product ID" });
        }

        const wishlist = await Wishlist.updateOne(
            { userId, 'products.productId': productId },
            { $pull: { products: { productId } } }
        );

        if (wishlist.modifiedCount > 0) {
            return res.status(200).json({ success: true, message: "Removed from wishlist!" });
        }

        return res.status(400).json({ success: false, message: "Product not found in wishlist!" });

    } catch (error) {
        console.error("❌ Error while removing from wishlist:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

module.exports = {
    loadWishList,
    addToWishList,
    removeFromWishlist
};
