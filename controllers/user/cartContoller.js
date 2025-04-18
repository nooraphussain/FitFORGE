const Product = require('../../models/productSchema')
const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
const Wishlist = require('../../models/wishlistSchema')

const loadCartPage = async (req, res) => {
    try {
        console.log('cart session', req.session.user);

        if (!req.session || !req.session.user) {
            return res.redirect('/');
        }

        const userId = req.session.user;

        let cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            model: 'Product',
            populate: {
                path: 'category',
                model: 'Category'
            }
        });
        
        if (!cart) {
            cart = new Cart({
                userId,
                items: []
            });
        }

        // Process cart items to calculate effective prices with offers
        const processedItems = cart.items.map(item => {
            const plainItem = item.toObject();

            // If product is missing, skip this item
            if (!plainItem.productId) {
                return null;
            }
            
            // Calculate effective price based on offers
            let effectivePrice = plainItem.productId.salePrice;
            let appliedOffer = 0;
            
            // Check for product offer
            if (plainItem.productId.offer) {
                appliedOffer = Math.max(appliedOffer, parseInt(plainItem.productId.offer));
            }
            
            // Check for category offer
            if (plainItem.productId.category && plainItem.productId.category.categoryOffer) {
                if (plainItem.productId.category.categoryOffer > appliedOffer) {
                    appliedOffer = plainItem.productId.category.categoryOffer;
                }
            }
            
            // Apply the highest offer
            if (appliedOffer > 0) {
                effectivePrice = plainItem.productId.salePrice - (plainItem.productId.salePrice * appliedOffer / 100);
            }
            
            plainItem.effectivePrice = effectivePrice;
            plainItem.appliedOffer = appliedOffer;
            plainItem.totalPrice = effectivePrice * plainItem.quantity;
            
            return plainItem;
        }).filter(item => item !== null); // Remove any null items
      
        let subtotal = processedItems.reduce((sum, item) => {
            return sum + (item.totalPrice || (item.price * item.quantity));
        }, 0);
        
        const TAX_RATE = 0.12; 
        const delivery = 50;
        let tax = subtotal * TAX_RATE;
        let total = subtotal + tax + delivery;

        cart.subtotal = subtotal;
        cart.tax = tax;
        cart.total = total + delivery;

        console.log('User Cart:', cart);

        const userData = await User.findById(userId);

        res.render('user/cart', {
            products: processedItems,
            user: userData,
            delivery,
            total
        });

    } catch (error) {
        console.error('Error while loading the cart page', error);
        res.redirect('/pageNotFound');
    }
}


const addToCart = async (req, res) => {
    try { 
        if (!req.session.user) {
            return res.status(401).json({ message: 'Unauthorized. Please log in.' });
        }

        const userId = req.session.user;
        const { productId, productPrice, quantity } = req.body;
        const qty = parseInt(quantity) || 1;
        const ProductPrice = parseFloat(productPrice);

        if (!productId) {
            return res.status(400).json({ message: 'Product ID is required' });
        }

        if (isNaN(ProductPrice) || ProductPrice <= 0) {
            return res.status(400).json({ message: 'Invalid product price.' });
        }

        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.status(404).json({ message: 'Product not found.' });
        }

        if (!product.category || !product.category.isListed) {
            return res.status(403).json({ message: 'This product belongs to an unlisted category and cannot be added to the cart.' });
        }

        if (product.quantity <= 0) {
            return res.status(400).json({ message: `Stock Out: '${product.productName}' is out of stock.` });
        }

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
        } else {
            effectivePrice = product.salePrice;
        }

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const existingItem = cart.items.find(item => item.productId.toString() === productId);
        const maxLimit = 5; 

        if (existingItem) {
            const newTotal = existingItem.quantity + qty;

            if (newTotal > product.quantity) {
                return res.status(400).json({ 
                    message: `Stock Out: Only ${product.quantity} units of '${product.productName}' available` 
                });
            }
            if (newTotal > maxLimit) {
                return res.status(400).json({ 
                    message: `Limit Reached: Only ${maxLimit} units of '${product.productName}' allowed in each order` 
                });
            }
            existingItem.quantity += qty;
            existingItem.price = effectivePrice; // Use the effective price with offers applied
            existingItem.totalPrice = existingItem.quantity * existingItem.price;
        } else {
            if (qty > product.quantity) {
                return res.status(400).json({ 
                    message: `Stock Out: Only ${product.quantity} units of '${product.productName}' available` 
                });
            }
            if (qty > maxLimit) {
                return res.status(400).json({ 
                    message: `Limit Reached: Only ${maxLimit} units of '${product.productName}' allowed in each order` 
                });
            }
            cart.items.push({
                productId,
                quantity: qty,
                price: effectivePrice, // Use the effective price with offers applied
                totalPrice: effectivePrice * qty,
                status: 'placed'
            });
        }

        await cart.save();

        await Wishlist.updateOne(
            { userId },
            { $pull: { products: { productId } } }
        );

        res.status(201).json({
            message: 'Successfully added to cart and removed from wishlist',
            cart: { ...cart.toObject(), productPrice: effectivePrice }
        });

    } catch (error) {
        console.error('Error while adding product to cart:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const updateCartItem = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user;

        // Find the cart that contains the item
        const cart = await Cart.findOne({ "items._id": productId });
        if (!cart) {
            return res.status(400).json({ success: false, message: "Cart item not found" });
        }

        // Find the specific item in the cart
        const item = cart.items.find(item => item._id.toString() === productId);
        if (!item) {
            return res.status(400).json({ success: false, message: "Cart item not found" });
        }

        // Convert quantity and price to numbers for proper calculation, babe!
        const qty = Number(quantity);
        item.quantity = qty;
        item.totalPrice = Number(item.price) * qty;

        await cart.save();

        res.json({ success: true, updatedQuantity: item.quantity, updatedTotalPrice: item.totalPrice });
    } catch (error) {
        console.error("❌ Cart update error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};




const removeCartItem = async (req, res) => {
  try {
    const { itemId } = req.body
    const id = req.session.user
    
    const cart = await Cart.findOne({ userId: id })
    if (!cart) {
      return res.status(404).send('Cart not found.')
    }
    
    const itemIndex = cart.items.findIndex(item => item._id.toString() === itemId)
    if (itemIndex === -1) {
      return res.status(404).send('Item not found in cart.')
    }
    
    cart.items.splice(itemIndex, 1)
    await cart.save()
    
    res.status(200).send('Item removed from cart successfully.')
  } catch (error) {
    console.error('Error removing item from cart:', error)
    res.status(500).send('Server error.')
  }
}


const loadCartLogout = async (req, res) => {
    console.log('loaded cart page while logged out');
    try {
        res.render('user/cart-logout'); 
    } catch (error) {
        console.log('Cart page not found!', error);
        res.status(500).send('Server error!');
    }
};

module.exports = {
    loadCartPage,
    addToCart,
    updateCartItem,
    removeCartItem,
    loadCartLogout
}
