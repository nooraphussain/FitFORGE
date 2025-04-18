const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Order = require("../../models/orderSchema");
const Cart = require("../../models/cartSchema");
const mongodb = require("mongodb");
const mongoose = require("mongoose");
const razorpay = require("razorpay");
const env = require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const easyinvoice = require("easyinvoice");
const Coupon = require("../../models/couponSchema");
const moment = require('moment');

let instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const createOrder = async (req, res) => {
    try {
        // Use req.session.user instead of req.user
        const userId = req.session.user || req.body.userId;

        if (!userId) {
            return res.status(400).json({ message: "User ID is missing" });
        }

        // Check for items under either "items" or "orderItems"
        let { totalAmount, address, paymentMethod } = req.body;
        console.log(totalAmount);
        
        let items = req.body.items || req.body.orderItems;

        // Debug log to inspect the full request body
        console.log("Request body:", req.body);

        if (!items) {
            return res.status(400).json({ message: "Items field is missing" });
        }
        if (!Array.isArray(items)) {
            if (typeof items === 'string') {
                try {
                    items = JSON.parse(items);
                    if (!Array.isArray(items)) {
                        items = [items];
                    }
                } catch (e) {
                    return res.status(400).json({ message: "Invalid items format" });
                }
            } else if (typeof items === 'object') {
                items = [items];
            } else {
                return res.status(400).json({ message: "Invalid items format" });
            }
        }

        // Validate user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Validate products and check stock availability
        let validItems = [];
        for (let item of items) {
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ message: `Product with ID ${item.productId} not found` });
            }
            if (product.stock < item.quantity) {
                return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
            }
            validItems.push({ product: product._id, quantity: item.quantity, price: product.price });
        }

        // Create new order
        const newOrder = new Order({
            user: userId,
            items: validItems,
            totalAmount,
            address,
            paymentMethod: req.body.paymentMethod,
            status: 'Pending'
        });

        if (req.body.paymentMethod === 'Razorpay') {
            newOrder.paymentDetails = {
                method: 'Razorpay',
                razorpayOrderId: req.body.razorpayOrderId,
                razorpayPaymentId: req.body.razorpayPaymentId,
                razorpaySignature: req.body.razorpaySignature
            };
        }

        await newOrder.save();

        // Reduce stock quantity
        for (let item of validItems) {
            await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
        }

        res.status(201).json({ message: "Order created successfully", order: newOrder });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const orderPlacedPage = async (req, res) => {
    try {
      console.log("Starting orderPlacedPage function")
      const orderId = req.session.orderId
  
      if (!orderId) {
        console.log("No orderId in session!")
        return res.redirect("/checkout")
      }
  
      console.log("Looking for order with ID:", orderId)
  
      const order = await Order.findById(orderId).populate({
        path: "orderedItems.product", 
        model: "Product",
        populate: { path: "category" },
      })
  
      if (!order) {
        console.log("Order not found:", orderId)
        return res.redirect("/pageNotFound")
      }
  
      console.log("Order found:", order.orderId)
      console.log("Order items count:", order.orderedItems ? order.orderedItems.length : 0)
  
      const userId = req.session.user
      let userData = null
      if (userId) {
        userData = await User.findOne({ _id: userId })
      }
  
      // Debug the order data structure
      console.log(
        "Order structure:",
        JSON.stringify({
          id: order._id,
          orderId: order.orderId,
          hasOrderedItems: !!order.orderedItems,
          orderedItemsCount: order.orderedItems ? order.orderedItems.length : 0,
        }),
      )
  
      const products = []
  
      if (order.orderedItems && order.orderedItems.length > 0) {
        for (const item of order.orderedItems) {
          if (!item.product) {
            console.log("Missing product in order item:", item._id)
            continue
          }
  
          let productImage = ""
          if (item.product.productImage) {
            if (Array.isArray(item.product.productImage) && item.product.productImage.length > 0) {
              productImage = item.product.productImage[0]
            } else if (typeof item.product.productImage === "string") {
              productImage = item.product.productImage
            }
          }
  
          products.push({
            _id: item.product._id,
            productId: item.product._id,
            productName: item.product.productName,
            salePrice: item.price || item.product.salePrice,
            quantity: Number(item.quantity),
            productImage: productImage,
            totalPrice: (item.price || item.product.salePrice) * item.quantity,
            category: item.product.category ? item.product.category._id : null,
            categoryName: item.product.category ? item.product.category.name : "N/A",
          })
        }
      }
  
      console.log(`Processed ${products.length} products for order`)
  
      const itemCount = products.length
      const deliveryDate = moment().add(7, "days").format("ddd, MMM Do YYYY")
  
      const addressDoc = await Address.findOne({ userId })
      let shippingAddress = {
        name: "N/A",
        email: "N/A",
        address: "No address available",
        phone: "N/A",
      }
  
      if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
        const addr = addressDoc.address.find((addr) => addr._id.toString() === order.address.toString())
  
        if (addr) {
          shippingAddress = {
            name: addr.name || "N/A",
            email: userData ? userData.email : "N/A",
            address: [addr.addressLine, addr.city, addr.state, addr.pincode].filter(Boolean).join(", "),
            phone: addr.phone || "N/A",
          }
        }
      }
  
      // Get product suggestions based on ordered categories
      const categoryIds = [...new Set(products.filter((p) => p.category).map((p) => p.category))]
  
      const orderedProductIds = products.map((p) => p.productId)
  
      let suggestions = []
      if (categoryIds.length > 0) {
        suggestions = await Product.find({
          category: { $in: categoryIds },
          _id: { $nin: orderedProductIds },
          isListed: true,
        })
          .limit(10)
          .lean()
      }
  
      console.log("Suggestions count:", suggestions.length)
  
      res.render("user/orderPlaced", {
        user: userData,
        order,
        total: order.finalAmount,
        itemCount,
        deliveryDate,
        products,
        shippingAddress,
        suggestions,
      })
    } catch (error) {
      console.error("Error while rendering orderPlaced page:", error)
      res.redirect("/pageNotFound")
    }
  }

const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user; 
        const userData = await User.findOne({ _id: userId });
        const cart = await Cart.findOne({ userId }).populate("items.productId");
        const userAddressDoc = await Address.findOne({ userId });
        
        if (!userAddressDoc || !userAddressDoc.address || userAddressDoc.address.length === 0) {
            return res.redirect('/address');
        }
        
        const selectedAddressId = userAddressDoc.address[0]._id.toString();
        
        let products = [];
        let subtotal = 0;
        let delivery = 50;
        let discount = 0;  
        let total = 0;
        
        if (cart && cart.items && cart.items.length) {
            products = cart.items.map(item => ({
                productName: item.productId.productName,
                salePrice: item.productId.salePrice,
                quantity: item.quantity,
                productImage: item.productId.productImage[0],
                totalPrice: item.productId.salePrice * item.quantity
            }));
            subtotal = products.reduce((acc, product) => acc + product.totalPrice, 0);
        }
        
        discount = (subtotal / 100) * 10;
        total = subtotal + delivery - discount;
        
        console.log("DEBUG: selectedAddressId =", selectedAddressId);
        res.render("user/checkout", {
            user: userData,
            addresses: userAddressDoc,
            products,
            subtotal,
            delivery,
            discount,
            total,
            selectedAddressId: selectedAddressId || ""
        });
    } catch (error) {
        console.error("Error loading checkout page:", error);
        res.status(500).send("Internal Server Error");
    }
};

const loadPayment = async (req, res) => {
    try {
      let id = req.query.id;
      const paymentMethod = req.query.paymentMethod || 'wallets';
      const userId = req.session.user;
      const userData = await User.findOne({ _id: userId });
      const cartData = await Cart.findOne({ userId }).populate("items.productId");
      if (!cartData) {
        return res.redirect("/checkout");
      }
  
      let products = [];
      let subtotal = 0;
      let delivery = 50;
      let discount = 0;
      let total = 0;
      let cashCollectionCharge = 50;
  
      if (Array.isArray(cartData.items)) {
        products = cartData.items.map(item => ({
          productId: item.productId._id,
          name: item.productId.productName,
          price: item.productId.salePrice,
          quantity: Number(item.quantity),
          // Recalculate totalPrice using salePrice * quantity
          totalPrice: item.productId.salePrice * item.quantity,
          offer: item.productId.offer
        }));
  
        subtotal = products.reduce((acc, product) => acc + product.totalPrice, 0);
        // Example: add 12% tax on subtotal
        subtotal = subtotal + (subtotal / 100) * 12;
      }
  
      discount = (subtotal / 100) * 10;
      total = subtotal + delivery - discount;
  
      // Apply coupon discount if available in session
      const offerPrice = req.session.offerPrice || 0;
      total = total - parseInt(offerPrice);
  
      const userAddress = await Address.find({ userId: userData._id }, { address: true });
      if (!id && userAddress[0] && userAddress[0].address.length > 0) {
        id = userAddress[0].address[0]._id.toString();
      }
      const selectedAddress = userAddress[0].address.find(addr => addr._id.toString() === id);
      if (!selectedAddress) {
        return res.redirect("/pageNotFound");
      }
  
      let razorpayOrder = null;
      if (paymentMethod === 'cards') {
        const razorOptions = {
          amount: Math.round(total * 100), 
          currency: "INR",
          receipt: "receipt_" + Date.now(),
        };
        razorpayOrder = await instance.orders.create(razorOptions);
        console.log("Created Razorpay Order:", razorpayOrder);
      }
      res.render('payment', {
        user: userData,
        customerName: selectedAddress.name,
        deliveryType: "Standard", 
        itemCount: products.length,
        items: products,
        totalMRP: subtotal,
        bagDiscount: discount,
        subtotal,
        delivery,
        total,
        cashCollectionCharge,
        selectedAddressId: id,
        cartItems: products,
        razorpayOrder,        
        key_id: process.env.RAZORPAY_KEY_ID
      });
      
    } catch (error) {
      console.log("error while loadPayment:", error);
      res.redirect("/pageNotFound");
    }
};
  
const orderConformed = async (req, res) => {
    try {
        const orderId = req.session.orderId;
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        if (!orderId) {
            return res.redirect('/pageNotFound');
        }
        const order = await Order.findById(orderId).populate('orderedItems.product').lean();
        if (!order) {
            return res.redirect('/pageNotFound');
        }
        res.render('order-conformed', { order, user: userData });
    } catch (error) {
        console.log('Error while loading the order success page!', error);
        res.redirect('/pageNotFound');
    }
};
  
const loadOrders = async (req, res) => {
    try {
      console.log("Starting loadOrders function")
      const userId = req.session.user
      const userData = await User.findOne({ _id: userId })
  

      const orders = await Order.find({ userId: userId }) 
        .sort({ createdOn: -1 })
        .populate({
          path: "orderedItems.product", 
          model: "Product",
          select: "productName productImage salePrice color",
        })
        .lean()
  
      console.log(`Found ${orders.length} orders for user ${userId}`)
  
      if (orders.length === 0) {
        console.log("No orders found for user:", userId)
      } else {

        console.log(
          "First order structure:",
          JSON.stringify({
            id: orders[0]._id,
            orderId: orders[0].orderId,
            hasOrderedItems: !!orders[0].orderedItems,
            orderedItemsCount: orders[0].orderedItems ? orders[0].orderedItems.length : 0,
          }),
        )
      }
  
      const formattedOrders = orders.map((order) => {

        console.log(`Processing order: ${order.orderId}, items: ${order.orderedItems?.length || 0}`)
  
        const daysPassed = moment().diff(moment(order.createdOn), "days")
        let displayStatus = ""
  
        if (daysPassed === 0) {
          displayStatus = "Pending"
        } else if (daysPassed >= 1 && daysPassed < 5) {
          displayStatus = "Processing"
        } else if (daysPassed === 5) {
          displayStatus = "Shipping"
        } else if (daysPassed >= 6) {
          displayStatus = "Delivered"
        }
  

        const products = []
  
        if (order.orderedItems && order.orderedItems.length > 0) {
          for (const item of order.orderedItems) {
            if (!item.product) continue
  

            let productImage = "default-image.jpg"
            if (item.product.productImage) {
              if (Array.isArray(item.product.productImage) && item.product.productImage.length > 0) {
                productImage = item.product.productImage[0]
              } else if (typeof item.product.productImage === "string") {
                productImage = item.product.productImage
              }
            }
  
            products.push({
              id: item.product._id.toString(),
              name: item.product.productName,
              image: productImage,
              quantity: item.quantity,
              price: item.price,
              color: item.product.color || "#ffffff",
              status: item.status || "Processing",
            })
          }
        }
  
        return {
          orderId: order.orderId,
          orderNumber: order._id.toString().slice(-6),
          orderDate: order.createdOn.toISOString().split("T")[0],
          deliveryDate: moment(order.createdOn).add(7, "days").format("ddd, MMM Do YYYY"),
          totalAmount: order.totalPrice,
          finalAmount: order.finalAmount,
          status: order.status,
          displayStatus,
          paymentMethod: order.paymentMethod,
          couponApplied: order.couponApplied,
          products: products,
          address: order.address ? `${order.address.city}, ${order.address.state}, ${order.address.pincode}` : "N/A",
        }
      })
  
      res.render("user/orders", { orders: formattedOrders, user: userData })
    } catch (error) {
      console.error("Error while loading the order page:", error)
      res.redirect("/pageNotFound")
    }
  }

const loadOrderDetails = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })
    const orderId = req.params.id

    // Find the order by orderId (not _id)
    const order = await Order.findOne({ orderId })
      .populate({
        path: "orderedItems.product", // Use orderedItems, not orderItems
        model: "Product",
        select: "productName salePrice regularPrice productImage color brand",
      })
      .populate({
        path: "userId", // Use userId, not user
        model: "User",
        select: "email",
      })
      .lean()

    if (!order) {
      console.log("Order not found with orderId:", orderId)
      return res.redirect("/pageNotFound")
    }

    console.log("Order found:", order._id)
    console.log("Order items count:", order.orderedItems ? order.orderedItems.length : 0)

    // Make sure to include the status from orderedItems
    const products = []

    if (order.orderedItems && order.orderedItems.length > 0) {
      for (const item of order.orderedItems) {
        if (!item.product) continue

        // Handle product image which could be an array or string
        let productImage = "default-image.jpg"
        if (item.product.productImage) {
          if (Array.isArray(item.product.productImage) && item.product.productImage.length > 0) {
            productImage = item.product.productImage[0]
          } else if (typeof item.product.productImage === "string") {
            productImage = item.product.productImage
          }
        }

        products.push({
          id: item._id,
          name: item.product.productName,
          regularPrice: item.product.regularPrice,
          salePrice: item.price, 
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          image: productImage,
          color: item.product.color,
          brand: item.product.brand,
          status: item.status,
          refunded: item.refunded,
          appliedOffer: item.appliedOffer || 0,
        })
      }
    }

    let addressDetails = { name: "N/A", addressLine: "", city: "", state: "", pincode: "", phone: "" }

    if (order.address) {
      // If address is stored as an ObjectId reference
      const addressDoc = await Address.findOne({ userId, "address._id": order.address })
      if (addressDoc) {
        const addr = addressDoc.address.find((a) => a._id.toString() === order.address.toString())
        if (addr) {
          addressDetails = addr
        }
      }
    }

    const formattedOrder = {
      orderId: order.orderId,
      orderNumber: order._id.toString().slice(-6).toUpperCase(),
      orderDate: order.createdOn.toLocaleDateString(),
      confirmationDate: order.status !== "Pending" ? order.createdOn.toLocaleDateString() : null,
      completionDate: order.status === "Completed" ? order.invoiceDate?.toLocaleDateString() : null,
      cancellationDate: order.status === "Cancelled" ? order.cancellationDate : null,
      status: order.status,
      paymentMethod: order.paymentMethod,
      paymentDetails: order.paymentDetails,
      shippingMethod: "Standard Delivery",
      email: order.userId?.email || "N/A",
      address: addressDetails
        ? `${addressDetails.name}, ${addressDetails.addressLine}, ${addressDetails.city}, ${addressDetails.state} - ${addressDetails.pincode}`
        : "Address not available",
      phone: addressDetails ? addressDetails.phone : "Phone not available",
      totalAmount: order.totalPrice,
      shippingCost: 5,
      discount: order.discount,
      finalAmount: order.finalAmount,
      products: products,
    }

    res.render("user/orderDetails", {
      order: formattedOrder,
      user: userData,
      products,
      moment: require("moment"),
    })
  } catch (error) {
    console.error("Error while loading the order detail page:", error)
    res.redirect("/pageNotFound")
  }
}

const returnItem = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const { itemId, reason } = req.body;
        
        if (!orderId || !itemId || !reason) {
            return res.status(400).json({ success: false, message: "Missing required parameters" });
        }
        
        const order = await Order.findOne({ orderId });
        
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        
        // Find the product in the order
        const productItem = order.orderedItems.find(item => item._id.toString() === itemId);
        
        if (!productItem) {
            return res.status(404).json({ success: false, message: "Product not found in order" });
        }
        
        // Check if the product is in Delivered status
        if (productItem.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: "Only delivered products can be returned" });
        }
        
        // Update the product status to Return Request and save the reason
        productItem.status = 'Return Request';
        productItem.returnReason = reason;
        
        // Check if all products have the same status
        const allSameStatus = order.orderedItems.every(item => item.status === 'Return Request');
        
        // If all products have the same status, update the order status too
        if (allSameStatus) {
            order.status = 'Return Request';
        }
        
        await order.save();
        
        return res.json({ 
            success: true, 
            message: "Return request submitted successfully", 
            newStatus: productItem.status
        });
    } catch (error) {
        console.error("Error submitting return request:", error);
        return res.status(500).json({ success: false, message: "Failed to submit return request" });
    }
};

const loadFailedOrderDetails = async (req, res) => {
    try {
      const userId = req.session.user
      const userData = await User.findOne({ _id: userId })
      const orderId = req.params.id
  
      // Check if this is a MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(orderId)) {
        // If not a valid ObjectId, redirect to the generic failed order details page
        return res.redirect(`/orderDetails-failed?orderId=${orderId}`)
      }
  
      const order = await Order.findById(orderId)
        .populate({
          path: "orderedItems.product",
          model: "Product",
          select: "productName salePrice regularPrice productImage color brand",
        })
        .populate({
          path: "userId",
          model: "User",
          select: "email",
        })
        .lean()
  
      if (!order) {
        console.log("Order not found with ID:", orderId)
        return res.redirect(`/orderDetails-failed?orderId=${orderId}`)
      }
  
      // Make sure the order belongs to the logged-in user
      if (order.userId._id.toString() !== userId.toString()) {
        return res.redirect("/pageNotFound")
      }
  
      console.log("Failed order found:", order._id)
      console.log("Order items count:", order.orderedItems ? order.orderedItems.length : 0)
  
      const products = []
  
      if (order.orderedItems && order.orderedItems.length > 0) {
        for (const item of order.orderedItems) {
          if (!item.product) continue
  
          // Handle product image which could be an array or string
          let productImage = "default-image.jpg"
          if (item.product.productImage) {
            if (Array.isArray(item.product.productImage) && item.product.productImage.length > 0) {
              productImage = item.product.productImage[0]
            } else if (typeof item.product.productImage === "string") {
              productImage = item.product.productImage
            }
          }
  
          products.push({
            id: item._id,
            name: item.product.productName,
            regularPrice: item.product.regularPrice,
            salePrice: item.price,
            price: item.price,
            quantity: item.quantity,
            total: item.price * item.quantity,
            image: productImage,
            color: item.product.color,
            brand: item.product.brand,
            status: "Payment Failed",
          })
        }
      }
  
      let addressDetails = { name: "N/A", addressLine: "", city: "", state: "", pincode: "", phone: "" }
  
      if (order.address) {
        // If address is stored as an ObjectId reference
        const addressDoc = await Address.findOne({ userId, "address._id": order.address })
        if (addressDoc) {
          const addr = addressDoc.address.find((a) => a._id.toString() === order.address.toString())
          if (addr) {
            addressDetails = addr
          }
        }
      }
  
      const formattedOrder = {
        orderId: order.orderId,
        orderNumber: order._id.toString().slice(-6).toUpperCase(),
        orderDate: order.createdOn.toLocaleDateString(),
        confirmationDate: order.createdOn.toLocaleDateString(),
        status: "Payment Failed",
        paymentMethod: order.paymentMethod,
        paymentDetails: order.paymentDetails,
        shippingMethod: "Standard Delivery",
        email: order.userId?.email || "N/A",
        address: addressDetails
          ? `${addressDetails.name}, ${addressDetails.addressLine}, ${addressDetails.city}, ${addressDetails.state} - ${addressDetails.pincode}`
          : "Address not available",
        phone: addressDetails ? addressDetails.phone : "Phone not available",
        totalAmount: order.totalPrice,
        shippingCost: 5,
        discount: order.discount,
        finalAmount: order.finalAmount,
        products: products,
        _id: order._id,
        addressId: order.address,
        cancellationDate: new Date(),
      }
  
      res.render("user/orderDetails-failed", {
        order: formattedOrder,
        user: userData,
        products,
        moment: require("moment"),
      })
    } catch (error) {
      console.error("Error while loading the failed order detail page:", error)
      res.redirect(`/orderDetails-failed?orderId=${req.params.id}`)
    }
  }

const orderSuccessPage = async (req, res) => {
  try {
    const orderId = req.session.orderId;
    const userId = req.session.user;
    
    if (!orderId) {
      return res.redirect('/checkout');
    }
    
    const userData = await User.findOne({ _id: userId });
    const order = await Order.findById(orderId);
    
    if (!order) {
      return res.redirect('/pageNotFound');
    }
    
    res.render('user/order-success', { order, user: userData, moment });
  } catch (error) {
    console.log('Error while loading the order success page!', error);
    res.redirect('/pageNotFound');
  }
};
  
module.exports = {
    createOrder,
    orderPlacedPage,
    getCheckoutPage,
    loadPayment,
    orderConformed,
    loadOrders,
    loadOrderDetails,
    returnItem,
    loadFailedOrderDetails,
    orderSuccessPage
};
