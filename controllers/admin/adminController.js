const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema")
const mongoose = require("mongoose")
const bycrypt = require("bcrypt")

const loadLogin = async (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard")
  }
  res.render("admin/admin-login", { message: null })
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body
    const admin = await User.findOne({ email, isAdmin: true })

    if (admin) {
      const passwordMatch = await bycrypt.compare(password, admin.password)
      if (passwordMatch) {
        req.session.admin = true
        return res.redirect("/admin")
      } else {
        return res.render("admin/admin-login", { message: "Invalid credentials" })
      }
    } else {
      return res.redirect("/admin/login")
    }
  } catch (error) {
    console.log("login error", error)
    return res.redirect("/pageError")
  }
}

const loadDashboard = async (req, res) => {
  try {
    if (req.session.admin) {
      // Get filter parameters
      const filterType = req.query.filterType || "daily"
      const customStartDate = req.query.startDate
      const customEndDate = req.query.endDate

      // Calculate date range based on filter type
      const endDate = new Date()
      let startDate = new Date()

      if (filterType === "daily") {
        startDate.setDate(endDate.getDate() - 1)
      } else if (filterType === "weekly") {
        startDate.setDate(endDate.getDate() - 7)
      } else if (filterType === "monthly") {
        startDate.setMonth(endDate.getMonth() - 1)
      } else if (filterType === "custom" && customStartDate && customEndDate) {
        startDate = new Date(customStartDate)
        endDate = new Date(customEndDate)
      }

      // Fetch orders within the date range
      const orders = await Order.find({
        createdOn: { $gte: startDate, $lte: endDate },
        status: { $nin: ["Cancelled", "Return Denied", "Returned"] },
      }).populate("userId", "name email")

      // Calculate total users
      const totalUsers = await User.countDocuments({ isAdmin: false })

      // Calculate sales metrics
      const totalSales = orders.length
      const totalOrderAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0)
      const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0)
      const totalFinalAmount = orders.reduce((sum, order) => sum + order.finalAmount, 0)

      // Calculate payment method distribution
      const paymentMethodCounts = {
        COD: 0,
        Razorpay: 0,
        Wallet: 0,
        Card: 0,
      }

      orders.forEach((order) => {
        if (paymentMethodCounts.hasOwnProperty(order.paymentMethod)) {
          paymentMethodCounts[order.paymentMethod]++
        }
      })

      // Get recent orders for display
      const recentOrders = await Order.find().sort({ createdOn: -1 }).limit(5).populate("userId", "name")

      // Format date function
      const formatDate = (date) => {
        return new Date(date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        })
      }

      // Get best selling products (top 10)
      const bestSellingProducts = await Order.aggregate([
        { $match: { status: { $nin: ["Cancelled", "Return Denied", "Returned"] } } },
        { $unwind: "$orderedItems" },
        {
          $group: {
            _id: "$orderedItems.product",
            totalQuantity: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ])

      // Populate product details
      const Product = require("../../models/productSchema")
      const populatedProducts = await Product.populate(bestSellingProducts, {
        path: "_id",
        select: "productName productImage salePrice brand category",
      })

      // Get best selling category (top 1)
      const bestSellingCategory = await Order.aggregate([
        { $match: { status: { $nin: ["Cancelled", "Return Denied", "Returned"] } } },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: "$productDetails.category",
            totalQuantity: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 1 },
      ])

      // Populate category details
      const Category = require("../../models/categorySchema")
      const populatedCategory = await Category.populate(bestSellingCategory, {
        path: "_id",
        select: "name description",
      })

      // Get best selling brands (top 3)
      const bestSellingBrands = await Order.aggregate([
        { $match: { status: { $nin: ["Cancelled", "Return Denied", "Returned"] } } },
        { $unwind: "$orderedItems" },
        {
          $lookup: {
            from: "products",
            localField: "orderedItems.product",
            foreignField: "_id",
            as: "productDetails",
          },
        },
        { $unwind: "$productDetails" },
        {
          $group: {
            _id: "$productDetails.brand",
            totalQuantity: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.price", "$orderedItems.quantity"] } },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 3 },
      ])

      res.render("admin/dashboard", {
        filterType: filterType,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        totalUsers,
        totalSales,
        totalOrderAmount,
        totalDiscounts,
        totalFinalAmount,
        paymentMethodCounts,
        recentOrders,
        formatDate,
        query: req.query,
        bestSellingProducts: populatedProducts,
        bestSellingCategory: populatedCategory.length > 0 ? populatedCategory[0] : null,
        bestSellingBrands,
      })
    } else {
      return res.redirect("/admin/login")
    }
  } catch (error) {
    console.log("Error while loading dashboard:", error)
    return res.redirect("/admin/pageError")
  }
}

const pageError = (req, res) => {
  res.render("admin/admin-error")
}

const logout = (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error while destrying session", err)
        return res.redirect("/pageError")
      }
      res.redirect("/admin/login")
    })
  } catch (error) {
    console.log("Un expected error during logout", error)
    res.redirect("/admin/pageError")
  }
}

const loadUsers = async (req, res) => {
  try {
    const customers = await User.find({})
    res.render("admin/customers", {
      customers,
    })
  } catch (error) {
    console.log("Error loading users page:", error)
    res.redirect("/admin/pageError")
  }
}

module.exports = {
  loadLogin,
  login,
  loadDashboard,
  pageError,
  logout,
  loadUsers,
}
