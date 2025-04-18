const User = require("../../models/userSchema")
const Order = require("../../models/orderSchema")
const mongoose = require("mongoose")

const loadWalletManagement = async (req, res) => {
    try {
      // Find all users with wallet transactions
      const users = await User.find({
        "wallet.transactions": { $exists: true, $not: { $size: 0 } },
      }).select("name email wallet")
  
      // Flatten all transactions from all users into a single array
      const allTransactions = []
  
      users.forEach((user) => {
        if (user.wallet && user.wallet.transactions && user.wallet.transactions.length > 0) {
          user.wallet.transactions.forEach((transaction) => {
            allTransactions.push({
              userId: user._id,
              userName: user.name,
              userEmail: user.email,
              transactionId: transaction._id,
              date: transaction.date,
              type: transaction.type,
              amount: transaction.amount,
              description: transaction.description,
              paymentId: transaction.paymentId,
              orderId: transaction.orderId,
            })
          })
        }
      })
  
      // Sort transactions by date (newest first)
      allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))
  
      res.render("admin/wallet", {
        transactions: allTransactions,
        currentPage: "wallet",
      })
    } catch (error) {
      console.error("Error loading wallet management:", error)
      res.redirect("/admin/pageError")
    }
  }

const getTransactionDetails = async (req, res) => {
  try {
    const { userId, transactionId } = req.params

    // Find the user and the specific transaction
    const user = await User.findById(userId).select("name email phoneNumber wallet")

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" })
    }

    // Find the specific transaction
    const transaction = user.wallet.transactions.find((t) => t._id.toString() === transactionId)

    if (!transaction) {
      return res.status(404).json({ success: false, message: "Transaction not found" })
    }

    // If transaction is related to an order, get order details
    let orderDetails = null
    if (transaction.orderId) {
      // Try to find by orderId field (which is a UUID in the Order schema)
      orderDetails = await Order.findOne({
        orderId: transaction.orderId,
      }).populate("orderedItems.product")

      // If not found by orderId, check if the orderId is actually an ObjectId
      if (!orderDetails && mongoose.Types.ObjectId.isValid(transaction.orderId)) {
        orderDetails = await Order.findById(transaction.orderId).populate("orderedItems.product")
      }

      // If still not found, try searching in the description for an order reference
      if (!orderDetails && transaction.description) {
        const orderIdMatch = transaction.description.match(/order[:\s]*#?([a-zA-Z0-9]+)/i)
        if (orderIdMatch && orderIdMatch[1]) {
          const possibleOrderId = orderIdMatch[1]
          orderDetails = await Order.findOne({
            orderId: possibleOrderId,
          }).populate("orderedItems.product")
        }
      }
    }

    res.json({
      success: true,
      transaction: {
        ...transaction.toObject(),
        userName: user.name,
        userEmail: user.email,
        userPhone: user.phoneNumber || "Not provided",
      },
      orderDetails: orderDetails,
    })
  } catch (error) {
    console.error("Error getting transaction details:", error)
    res.status(500).json({ success: false, message: "Server error" })
  }
}
  
const filterTransactions = async (req, res) => {
try {
    const { startDate, endDate, type, userId } = req.query

    // Build the query
    const query = {
    "wallet.transactions": { $exists: true, $not: { $size: 0 } },
    }

    // Add user filter if provided
    if (userId) {
    query._id = new mongoose.Types.ObjectId(userId)
    }

    // Find users based on the query
    const users = await User.find(query).select("name email wallet")

    // Flatten and filter transactions
    const allTransactions = []

    users.forEach((user) => {
    if (user.wallet && user.wallet.transactions && user.wallet.transactions.length > 0) {
        let filteredTransactions = user.wallet.transactions

        // Filter by transaction type
        if (type) {
        filteredTransactions = filteredTransactions.filter((t) => t.type === type)
        }

        // Filter by date range
        if (startDate && endDate) {
        const start = new Date(startDate)
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999) // Set to end of day

        filteredTransactions = filteredTransactions.filter((t) => {
            const transactionDate = new Date(t.date)
            return transactionDate >= start && transactionDate <= end
        })
        }

        filteredTransactions.forEach((transaction) => {
        allTransactions.push({
            userId: user._id,
            userName: user.name,
            userEmail: user.email,
            transactionId: transaction._id,
            date: transaction.date,
            type: transaction.type,
            amount: transaction.amount,
            description: transaction.description,
            paymentId: transaction.paymentId,
            orderId: transaction.orderId,
        })
        })
    }
    })

    // Sort transactions by date (newest first)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date))

    res.json({ success: true, transactions: allTransactions })
} catch (error) {
    console.error("Error filtering transactions:", error)
    res.status(500).json({ success: false, message: "Server error" })
}
}

const getWalletUsers = async (req, res) => {
try {
    const users = await User.find({
    "wallet.transactions": { $exists: true, $not: { $size: 0 } },
    }).select("name email")

    res.json({ success: true, users })
} catch (error) {
    console.error("Error getting wallet users:", error)
    res.status(500).json({ success: false, message: "Server error" })
}
}

const getOrderDetailsByOrderId = async (req, res) => {
  try {
    const { orderId } = req.params

    const order = await Order.findOne({ orderId: orderId })

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" })
    }

    res.json({
      success: true,
      order: order,
    })
  } catch (error) {
    console.error("Error getting order details:", error)
    res.status(500).json({ success: false, message: "Server error" })
  }
}


module.exports = {
  loadWalletManagement,
  getTransactionDetails,
  filterTransactions,
  getWalletUsers,
  getOrderDetailsByOrderId
}
