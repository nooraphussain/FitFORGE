const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Cart = require("../../models/cartSchema")
const mongodb = require("mongodb")
const mongoose = require("mongoose")
const razorpay = require("razorpay")
const env = require("dotenv").config()
const crypto = require("crypto")
const moment = require("moment")
const fs = require("fs")
const path = require("path")
const easyinvoice = require("easyinvoice")

const instance = new razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const getCheckoutPage = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category",
      },
    })

    const userAddresses = await Address.find({ userId })

    let products = []
    let regularSubtotal = 0
    let discountedSubtotal = 0
    const delivery = 50 

    if (cart && cart.items.length > 0) {
      products = cart.items
        .filter((item) => item.productId) // Only valid products
        .map((item) => {
          const product = item.productId
          const quantity = item.quantity

          const productOffer = Number.parseInt(product.offer) || 0
          const categoryOffer = product.category?.categoryOffer || 0
          const appliedOffer = Math.max(productOffer, categoryOffer)

          const effectivePrice = product.salePrice - (product.salePrice * appliedOffer) / 100
          const totalPrice = effectivePrice * quantity


          regularSubtotal += product.regularPrice * quantity
          discountedSubtotal += totalPrice

          return {
            _id: product._id,
            productName: product.productName,
            regularPrice: product.regularPrice,
            salePrice: product.salePrice,
            effectivePrice,
            appliedOffer,
            quantity,
            productImage: product.productImage[0],
            totalPrice,
            stock: product.quantity,
          }
        })
    }

    const discountAmount = regularSubtotal - discountedSubtotal
    const total = discountedSubtotal + delivery

    res.render("user/checkout", {
      user: userData,
      addresses: userAddresses,
      products,
      subtotal: discountedSubtotal,
      regularSubtotal,
      delivery,
      discount: discountAmount,
      total,
      discountedSubtotal,
      formattedDate: new Date().toLocaleDateString(),
    })
  } catch (error) {
    console.error("Error loading checkout page:", error)
    res.status(500).send("Internal Server Error")
  }
}

const loadPayment = async (req, res) => {
  try {
    const id = req.query.id
    const paymentMethod = req.query.paymentMethod || "wallets"
    const isRetry = req.query.retry === "true"
    const userId = req.session.user

    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to continue" })
    }

    const userData = await User.findOne({ _id: userId })

    // If this is a retry payment, we need to get the order details instead of cart
    let products = []
    let regularSubtotal = 0
    let saleSubtotal = 0
    let total = 0
    let discount = 0
    const delivery = 50

    if (isRetry && req.session.retryOrderId) {
      // Get the failed order
      const failedOrder = await Order.findById(req.session.retryOrderId).populate({
        path: "orderedItems.product",
        model: "Product",
        populate: {
          path: "category",
          model: "Category",
        },
      })

      if (!failedOrder) {
        return res.status(404).json({ success: false, message: "Failed order not found" })
      }

      // Use the order details for payment
      products = failedOrder.orderedItems
        .filter((item) => item.product)
        .map((item) => {
          const product = item.product
          return {
            _id: product._id,
            productName: product.productName,
            regularPrice: product.regularPrice,
            salePrice: product.salePrice,
            effectivePrice: item.price,
            quantity: item.quantity,
            productImage: Array.isArray(product.productImage) ? product.productImage[0] : product.productImage,
            totalPrice: item.price * item.quantity,
            stock: Number(product.quantity) || 0,
          }
        })

      // Use the order's total and discount
      total = failedOrder.finalAmount
      discount = failedOrder.discount
    } else {
      // Regular checkout flow - get cart data
      const cartData = await Cart.findOne({ userId }).populate({
        path: "items.productId",
        model: "Product",
        populate: {
          path: "category",
          model: "Category",
        },
      })

      if (!cartData || !cartData.items || cartData.items.length === 0) {
        return res.status(400).json({ success: false, message: "Your cart is empty" })
      }

      // Calculate totals from cart
      products = cartData.items
        .filter((item) => item.productId)
        .map((item) => {
          const product = item.productId
          const quantity = Number(item.quantity) || 0
          const regularPrice = Number(product.regularPrice) || 0
          const salePrice = Number(product.salePrice) || 0
          const productOffer = Number(product.offer) || 0
          const categoryOffer = Number(product.category?.categoryOffer) || 0
          const appliedOffer = Math.max(productOffer, categoryOffer)
          const effectivePrice = salePrice - (salePrice * appliedOffer) / 100
          const totalPrice = effectivePrice * quantity

          regularSubtotal += regularPrice * quantity
          saleSubtotal += effectivePrice * quantity

          return {
            _id: product._id,
            productName: product.productName,
            regularPrice,
            salePrice,
            effectivePrice,
            appliedOffer,
            quantity,
            productImage: Array.isArray(product.productImage) ? product.productImage[0] : product.productImage,
            totalPrice,
            stock: Number(product.quantity) || 0,
          }
        })

      // Apply coupon discount if available
      const couponOffer = req.session.offerPrice ? Number.parseFloat(req.session.offerPrice) : 0
      discount = regularSubtotal - saleSubtotal + couponOffer
      total = saleSubtotal - couponOffer + delivery
    }

    // Create Razorpay order if payment method is cards
    let razorpayOrder = null
    if (paymentMethod === "cards") {
      try {

        // Make sure the amount is an integer by using Math.round
        const amountInPaise = Math.round(total * 100)

        // Check if Razorpay keys are available
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
          console.error("Razorpay API keys are missing")
          return res.status(500).json({
            success: false,
            message: "Payment service configuration error. Please contact support.",
          })
        }

        // Create Razorpay instance
        const instance = new razorpay({
          key_id: process.env.RAZORPAY_KEY_ID,
          key_secret: process.env.RAZORPAY_KEY_SECRET,
        })

        const orderOptions = {
          amount: amountInPaise,
          currency: "INR",
          receipt: "receipt_" + new Date().getTime(),
        }

        console.log("Creating Razorpay order with options:", orderOptions)
        razorpayOrder = await instance.orders.create(orderOptions)
        console.log("Created Razorpay Order:", razorpayOrder)
      } catch (razorpayError) {
        console.error("Razorpay order creation error:", razorpayError)
        return res.status(500).json({
          success: false,
          message: "Failed to create payment order. Please try again.",
          error: razorpayError.message,
        })
      }
    }

    // Get user address
    const userAddress = await Address.findOne({ userId })
    if (!userAddress || !userAddress.address || userAddress.address.length === 0) {
      return res.status(404).json({ success: false, message: "Please add a delivery address" })
    }

    const selectedAddress = userAddress.address.find((addr) => addr._id.toString() === id)
    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: "Selected address not found" })
    }

    // If this is an AJAX request, return JSON
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({
        success: true,
        razorpayOrder,
        key_id: process.env.RAZORPAY_KEY_ID,
        total,
        discount,
        delivery,
        user: {
          name: userData.name || "",
          email: userData.email || "",
          phone: userData.phone || "",
        },
      })
    }

    // Otherwise render the payment page
    res.render("user/payment", {
      user: userData,
      customerName: selectedAddress.name,
      deliveryType: "Standard",
      itemCount: products.length,
      items: products,
      totalMRP: regularSubtotal,
      bagDiscount: discount,
      subtotal: regularSubtotal,
      delivery,
      total,
      selectedAddressId: id,
      cartItems: products,
      razorpayOrder,
      key_id: process.env.RAZORPAY_KEY_ID,
      isRetry: isRetry,
    })
  } catch (error) {
    console.error("Error during loadPayment:", error)
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(500).json({ success: false, message: "Server error", error: error.message })
    }
    res.redirect("/pageNotFound")
  }
}

const orderPlaced = async (req, res) => {
  try {
    const userId = req.session.user
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to continue" })
    }

    const { addressId, paymentMethod, razorpayPaymentId, razorpayOrderId, razorpaySignature } = req.body

    if (paymentMethod === "Razorpay" && razorpayOrderId && razorpayPaymentId && razorpaySignature) {
      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex")

      if (generatedSignature !== razorpaySignature) {
        return res.status(400).json({
          success: false,
          message: "Invalid payment signature",
          orderId: razorpayOrderId,
        })
      }
    }

    // Fetch the user's cart with product and category populated
    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      model: "Product",
      populate: {
        path: "category",
        model: "Category",
      },
    })

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: "No items in cart" })
    }

    // Build orderedItems from cart data (using the correct field name as per your schema)
    const orderedItems = cart.items
      .filter((item) => item.productId)
      .map((item) => {
        const product = item.productId
        const quantity = Number(item.quantity) || 0
        const regularPrice = Number(product.regularPrice) || 0
        const salePrice = Number(product.salePrice) || 0
        const productOffer = Number(product.offer) || 0
        const categoryOffer = Number(product.category?.categoryOffer) || 0
        const appliedOffer = Math.max(productOffer, categoryOffer)
        const effectivePrice = salePrice - (salePrice * appliedOffer) / 100
        const price = effectivePrice
        const total = price * quantity

        return {
          product: product._id, // Use product, not productId
          quantity,
          price,
          status: "Pending",
        }
      })

    // Calculate totals
    let regularSubtotal = 0
    let saleSubtotal = 0

    cart.items.forEach((item) => {
      if (item.productId) {
        const product = item.productId
        const quantity = Number(item.quantity) || 0
        const regularPrice = Number(product.regularPrice) || 0
        const salePrice = Number(product.salePrice) || 0
        const productOffer = Number(product.offer) || 0
        const categoryOffer = Number(product.category?.categoryOffer) || 0
        const appliedOffer = Math.max(productOffer, categoryOffer)
        const effectivePrice = salePrice - (salePrice * appliedOffer) / 100

        regularSubtotal += regularPrice * quantity
        saleSubtotal += effectivePrice * quantity
      }
    })

    // Apply coupon discount if available
    const couponOffer = req.session.offerPrice ? Number.parseFloat(req.session.offerPrice) : 0
    const discount = regularSubtotal - saleSubtotal + couponOffer
    const totalPrice = saleSubtotal - couponOffer

    // Check if COD is allowed based on total price
    if (paymentMethod === "COD" && totalPrice >= 1000) {
      return res.status(400).json({ 
        success: false, 
        message: "Cash on Delivery is not available for orders of ₹1000 or above. Please choose a different payment method." 
      })
    }

    // Get address
    const address = await Address.findOne({ userId })
    if (!address) {
      return res.status(404).json({ success: false, message: "Address not found" })
    }

    const selectedAddress = address.address.find((addr) => addr._id.toString() === addressId)
    if (!selectedAddress) {
      return res.status(404).json({ success: false, message: "Selected address not found" })
    }

    // Generate a unique orderId
    const orderId = "ORD" + Date.now().toString().slice(-10)

    // Create the new order document with the correct field names as per your schema
    const newOrder = new Order({
      orderId: orderId,
      userId: userId, 
      orderedItems: orderedItems, 
      discount: discount,
      totalPrice: totalPrice,
      finalAmount: totalPrice,
      address: selectedAddress._id, 
      paymentMethod: paymentMethod,
      status: "Pending",
      createdOn: new Date(),
      paymentDetails:
        paymentMethod === "Razorpay"
          ? {
              razorpayOrderId,
              razorpayPaymentId,
              razorpaySignature,
            }
          : null,
    })

    // Debug log to verify orderedItems is populated
    console.log("Creating new order with items:", JSON.stringify(orderedItems, null, 2))

    await newOrder.save()
    console.log("New order created:", newOrder._id, newOrder.orderId)

    // Reduce stock for each ordered item
    for (const item of orderedItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { quantity: -item.quantity } }, { new: true })
    }

    // Store order ID in session for confirmation page
    req.session.orderId = newOrder._id

    // Clear cart after successful order
    await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } })

    // Clear coupon session data
    if (req.session.offerPrice) {
      delete req.session.offerPrice
    }

    res.status(201).json({ 
      success: true, 
      order: newOrder,
      redirect: '/order-success' 
    })
  } catch (error) {
    console.error("Error placing order:", error)
    res.status(500).json({ success: false, message: "Failed to place order" })
  }
}

const orderConformed = async (req, res) => {
  try {
    const orderId = req.session.orderId
    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })

    if (!orderId) {
      return res.redirect("/pageNotFound")
    }

    const order = await Order.findById(orderId).populate("orderItems.productId")

    if (!order) {
      return res.redirect("/pageNotFound")
    }

    res.render("order-conformed", { order, user: userData })
  } catch (error) {
    console.log("Error while loading the order success page!", error)
    res.redirect("/pageNotFound")
  }
}

const loadOrders = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })

    const orders = await Order.find({ user: userId })
      .populate({
        path: "orderItems.productId",
        model: "Product",
        select: "productName productImage salePrice",
      })
      .lean()

    const formattedOrders = orders.map((order) => ({
      orderId: order.orderId,
      orderNumber: order._id.toString().slice(-6),
      orderDate: order.createdOn.toISOString().split("T")[0],
      totalAmount: order.totalPrice,
      finalAmount: order.finalAmount,
      status: order.status,
      paymentMethod: order.paymentMethod,
      couponApplied: order.couponApplied,
      products:
        order.orderItems
          ?.filter((item) => item.productId)
          .map((item) => ({
            id: item.productId?._id?.toString() || "N/A",
            name: item.productId?.productName || "Unknown Product",
            image: item.productId?.productImage?.[0] || "default-image.jpg",
            quantity: item.quantity,
            price: item.price,
          })) || [],
      address: order.address ? `${order.address.city}, ${order.address.state}, ${order.address.pincode}` : "N/A",
    }))

    res.render("my-orders", { orders: formattedOrders, user: userData })
  } catch (error) {
    console.error("Error while loading the order page:", error)
    res.redirect("/pageNotFound")
  }
}

const loadOrderDetails = async (req, res) => {
  try {
    const orderId = req.params.id

    const order = await Order.findOne({ orderId })
      .populate({
        path: "orderItems.productId",
        model: "Product",
        select: "name price image",
      })
      .populate({
        path: "userId",
        model: "User",
        select: "email",
      })
      .lean()

    if (!order) {
      return res.redirect("/pageNotFound")
    }

    const formattedOrder = {
      orderId: order.orderId,
      orderNumber: order._id.toString().slice(-6).toUpperCase(),
      orderDate: order.createdOn.toLocaleDateString(),
      confirmationDate: order.status !== "Pending" ? order.createdOn.toLocaleDateString() : null,
      completionDate: order.status === "Completed" ? order.invoiceDate?.toLocaleDateString() : null,
      cancellationDate: order.status === "Cancelled" ? order.invoiceDate?.toLocaleDateString() : null,
      status: order.status,
      paymentMethod: order.paymentMethod,
      shippingMethod: "Standard Delivery",
      email: order.userId?.email || "N/A",
      address: order.address
        ? `${order.address.name}, ${order.address.city}, ${order.address.state}, ${order.address.pincode}`
        : "Address not available",
      totalAmount: order.totalPrice,
      shippingCost: 5,
      discount: order.discount,
      finalAmount: order.finalAmount,
      products: order.orderItems.map((item) => ({
        name: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity,
        totalPrice: item.productId.price * item.quantity,
        image: item.productId.image,
        category: item.productId.category || "Unknown",
        brand: item.productId.brand || "Unknown",
        offer: item.offer || "",
      })),
    }

    console.log(formattedOrder.products)

    res.render("orderDetails", { order: formattedOrder })
  } catch (error) {
    console.error("Error while loading the order detail page:", error)
    res.redirect("/pageNotFound")
  }
}

const orderCancel = async (req, res) => {
  try {
    const orderId = req.params.id
    const order = await Order.findOne({ orderId: orderId })

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" })
    }

    for (const item of order.orderedItems) {
      await Product.findByIdAndUpdate(item.product, { $inc: { quantity: item.quantity } }, { new: true })
    }

    await Order.findOneAndDelete({ orderId: orderId })

    res.json({ success: true, message: "Order cancelled and stock updated successfully" })
  } catch (error) {
    console.error("Error while cancelling the order:", error)
    res.status(500).json({ success: false, message: "Server error" })
  }
}

const updateCartItem = async (req, res) => {
  try {
    console.log("Update Cart Called:", req.params, req.body)
    const productId = req.params.productId
    const { quantity } = req.body
    const qty = Number(quantity)

    // Fetch product for available stock
    const product = await Product.findById(productId)
    if (!product) {
      console.log("Product not found")
      return res.status(404).json({ success: false, message: "Product not found, babe!" })
    }
    if (qty > product.quantity) {
      return res.status(400).json({ success: false, message: `Only ${product.quantity} items available!` })
    }

    const userId = req.session.user
    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(400).json({ success: false, message: "Cart not found, darling!" })
    }
    const item = cart.items.find((item) => item.productId.toString() === productId)
    if (!item) {
      return res.status(400).json({ success: false, message: "Cart item not found, darling!" })
    }

    item.quantity = qty
    item.totalPrice = Number(item.price) * qty

    await cart.save()
    console.log("Cart updated:", cart)
    res.json({ success: true, updatedQuantity: item.quantity, updatedTotalPrice: item.totalPrice })
  } catch (error) {
    console.error("❌ Cart update error:", error)
    res.status(500).json({ success: false, message: "Internal Server Error, babe!" })
  }
}

const removeCartItem = async (req, res) => {
  try {
    const productId = req.params.productId
    const userId = req.session.user
    const cart = await Cart.findOne({ userId })
    if (!cart) {
      return res.status(404).json({ success: false, message: "Cart not found" })
    }
    const initialLength = cart.items.length
    cart.items = cart.items.filter((item) => item.productId.toString() !== productId)
    if (cart.items.length === initialLength) {
      return res.status(404).json({ success: false, message: "Product not found in cart" })
    }
    await cart.save()
    res.json({ success: true, message: "Product removed from cart successfully" })
  } catch (error) {
    console.error("Error removing cart item:", error)
    res.status(500).json({ success: false, message: "Server error" })
  }
}

const verifyPayment = async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body

    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      return res.status(400).json({ success: false, message: "Missing payment details" })
    }

    // Check if Razorpay keys are available
    if (!process.env.RAZORPAY_KEY_SECRET) {
      console.error("Razorpay secret key is missing")
      return res.status(500).json({
        success: false,
        message: "Payment verification configuration error. Please contact support.",
      })
    }

    // Verify the payment signature
    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpayOrderId + "|" + razorpayPaymentId)
      .digest("hex")

    if (generatedSignature !== razorpaySignature) {
      console.error("Payment signature verification failed")
      return res.status(400).json({ success: false, message: "Invalid payment signature" })
    }

    console.log("Payment verified successfully")
    return res.status(200).json({ success: true, message: "Payment verified successfully" })
  } catch (error) {
    console.error("Error verifying payment:", error)
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

const paymentFailed = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })

    // Get error message and orderId from query parameters
    const paymentError = req.query.error || "There was an issue with your payment method."
    const razorpayOrderId = req.query.orderId

    // Create a temporary order object with minimal information
    const order = {
      orderNumber: razorpayOrderId ? razorpayOrderId.substring(0, 10) : "TEMP" + Date.now().toString().slice(-6),
      id: razorpayOrderId || "unknown",
      createdAt: new Date(),
    }

    res.render("user/payment-fail", {
      user: userData,
      order: order,
      paymentError: paymentError,
    })
  } catch (error) {
    console.error("Error rendering payment failure page:", error)
    res.render("user/payment-fail", {
      user: null,
      order: { orderNumber: "Unknown", id: "unknown" },
      paymentError: "An unexpected error occurred",
    })
  }
}

const retryPayment = async (req, res) => {
  try {
    const orderId = req.params.id

    if (!orderId) {
      return res.status(400).json({ success: false, message: "Order ID is required" })
    }

    const userId = req.session.user
    if (!userId) {
      return res.status(401).json({ success: false, message: "Please log in to continue" })
    }

    // Find the failed order
    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" })
    }

    // Check if this is the user's order
    if (order.userId.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized access to this order" })
    }

    // Store the order ID in session for the payment page
    req.session.retryOrderId = orderId

    res.redirect(`/payment?id=${order.address}&paymentMethod=cards&retry=true`)
  } catch (error) {
    console.error("Error in retryPayment:", error)
    res.status(500).json({ success: false, message: "Server error", error: error.message })
  }
}

const OrderDetailFailPage = async (req, res) => {
  try {
    const userId = req.session.user
    const userData = await User.findOne({ _id: userId })

    // Try to get Razorpay orderId from query parameters
    const razorpayOrderId = req.query.razorpayOrderId || req.params.orderId || req.query.orderId

    // Create a basic order object with the Razorpay order ID
    let order = {
      orderNumber: razorpayOrderId ? razorpayOrderId.substring(0, 10) : "TEMP" + Date.now().toString().slice(-6),
      id: razorpayOrderId || "unknown",
      createdAt: new Date(),
      orderDate: new Date(),
      cancellationDate: new Date(),
      // Add sample product data for failed orders
      products: [
        {
          name: "Sample Product",
          price: 999,
          quantity: 1,
          image: "default-image.jpg",
          category: "Sample Category",
          brand: "Sample Brand",
        },
      ],
    }

    // If it's a MongoDB ObjectId, try to find the actual order
    if (mongoose.Types.ObjectId.isValid(razorpayOrderId)) {
      try {
        const foundOrder = await Order.findById(razorpayOrderId).populate({
          path: "orderedItems.product",
          model: "Product",
          select: "productName price productImage category brand",
        })

        if (foundOrder) {
          order = {
            orderNumber: foundOrder._id.toString().slice(-6),
            id: foundOrder._id,
            createdAt: foundOrder.createdOn || new Date(),
            orderDate: foundOrder.createdOn || new Date(),
            cancellationDate: new Date(),
            products: foundOrder.orderedItems.map((item) => ({
              name: item.product?.productName || "Unknown Product",
              price: item.price || 0,
              quantity: item.quantity || 1,
              image: Array.isArray(item.product?.productImage)
                ? item.product.productImage[0]
                : item.product?.productImage || "default-image.jpg",
              category: item.productId?.category?.name || item.productId?.category || "Unknown",
              brand: item.product?.brand || "Unknown",
            })),
          }
        }
      } catch (err) {
        console.log("Error finding order by ID:", err)
      }
    } else {
      // For Razorpay order IDs, try to get cart data to show what was being purchased
      try {
        const cart = await Cart.findOne({ userId }).populate({
          path: "items.productId",
          model: "Product",
        })

        if (cart && cart.items && cart.items.length > 0) {
          order.products = cart.items.map((item) => ({
            name: item.productId.productName || "Product",
            price: item.productId.salePrice || 0,
            quantity: item.quantity || 1,
            image: Array.isArray(item.productId.productImage)
              ? item.productId.productImage[0]
              : item.productId.productImage || "default-image.jpg",
            category: item.productId?.category?.name || item.productId?.category || "Unknown",
            brand: item.productId.brand || "Unknown",
          }))
        }
      } catch (cartErr) {
        console.log("Error getting cart data:", cartErr)
      }
    }

    console.log("Rendering orderDetails-failed with order:", {
      orderNumber: order.orderNumber,
      productsCount: order.products.length,
    })

    res.render("user/orderDetails-failed", {
      user: userData,
      order: order,
      moment: require("moment"),
    })
  } catch (error) {
    console.error("Error fetching order:", error)
    res.render("user/orderDetails-failed", {
      user: null,
      order: {
        orderNumber: "Unknown",
        id: "unknown",
        createdAt: new Date(),
        orderDate: new Date(),
        cancellationDate: new Date(),
        products: [
          {
            name: "Sample Product",
            price: 999,
            quantity: 1,
            image: "default-image.jpg",
            category: "Sample Category",
            brand: "Sample Brand",
          },
        ],
      },
      moment: require("moment"),
    })
  }
}

const removeCoupon = async (req, res) => {
  try {
    // Clear the coupon session data
    if (req.session.offerPrice) {
      delete req.session.offerPrice;
    }
    
    res.status(200).json({ 
      success: true, 
      message: "Coupon removed successfully" 
    });
  } catch (error) {
    console.error("Error removing coupon:", error);
    res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
};


module.exports = {
  getCheckoutPage,
  loadPayment,
  orderPlaced,
  orderConformed,
  loadOrders,
  loadOrderDetails,
  orderCancel,
  updateCartItem,
  removeCartItem,
  verifyPayment,
  paymentFailed,
  retryPayment,
  OrderDetailFailPage,
  removeCoupon  
}