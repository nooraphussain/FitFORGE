const Coupon = require("../../models/couponSchema")
const moment = require("moment")
const Order = require("../../models/orderSchema") // Import the Order model

const loadCoupon = async (req, res) => {
  try {
    const itemsPerPage = 10
    const currentPage = Number.parseInt(req.query.page) || 1

    const totalCoupons = await Coupon.countDocuments()
    const totalPages = Math.ceil(totalCoupons / itemsPerPage)

    const coupons = await Coupon.find()
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage)
      .exec()

    res.render("admin/coupons", {
      coupons,
      currentPage,
      totalPages,
      itemsPerPage,
      moment,
    })
  } catch (error) {
    console.error("Error loading admin coupons:", error)
    res.redirect("/admin/pageError")
  }
}

const createCoupon = async (req, res) => {
  try {
    const { name, startDate, expiryDate, offerPrice, minPrice } = req.body

    if (!name || !startDate || !expiryDate || isNaN(offerPrice) || isNaN(minPrice)) {
      return res.status(400).json({ message: "All fields are required." })
    }

    const startDateObj = new Date(startDate)
    const expiryDateObj = new Date(expiryDate)
    const todayObj = new Date()
    todayObj.setHours(0, 0, 0, 0)
    startDateObj.setHours(0, 0, 0, 0)

    if (startDateObj < todayObj) {
      return res.status(400).json({ message: "Start date cannot be in the past." })
    }

    if (expiryDateObj <= startDateObj) {
      return res.status(400).json({ message: "Expiry date must be later than the start date." })
    }

    if (offerPrice >= minPrice) {
      return res.status(400).json({ message: "Offer price should be less than the minimum price." })
    }

    // Case-insensitive check for existing coupon
    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
    })

    if (existingCoupon) {
      return res.status(400).json({ message: "Coupon with that name already exists (case-insensitive)." })
    }

    const newCoupon = new Coupon({
      name,
      startDate,
      expireOn: expiryDate,
      offerPrice,
      minimumPrice: minPrice,
      createdOn: new Date().toISOString().split("T")[0],
    })

    await newCoupon.save()
    res.status(201).json({ message: "Coupon added successfully!", coupon: newCoupon })
  } catch (error) {
    console.error("Error creating coupon:", error)
    res.status(500).json({ message: "Internal server error." })
  }
}

const editCoupon = async (req, res) => {
  try {
    const couponId = req.query.id
    const { name, startDate, expiryDate, offerPrice, minPrice } = req.body

    if (!couponId || !name || !startDate || !expiryDate || isNaN(offerPrice) || isNaN(minPrice)) {
      return res.status(400).json({ message: "All fields are required." })
    }

    const startDateObj = new Date(startDate)
    const expiryDateObj = new Date(expiryDate)
    const todayObj = new Date()
    todayObj.setHours(0, 0, 0, 0)
    startDateObj.setHours(0, 0, 0, 0)

    if (expiryDateObj <= startDateObj) {
      return res.status(400).json({ message: "Expiry date must be later than the start date." })
    }

    if (offerPrice >= minPrice) {
      return res.status(400).json({ message: "Offer price should be less than the minimum price." })
    }

    // Check for existing coupon with same name (case-insensitive) but different ID
    const existingCoupon = await Coupon.findOne({
      name: { $regex: new RegExp(`^${name}$`, "i") },
      _id: { $ne: couponId },
    })

    if (existingCoupon) {
      return res.status(400).json({ message: "Another coupon with that name already exists (case-insensitive)." })
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(
      couponId,
      {
        name,
        startDate,
        expireOn: expiryDate,
        offerPrice,
        minimumPrice: minPrice,
      },
      { new: true },
    )

    if (!updatedCoupon) {
      return res.status(404).json({ message: "Coupon not found." })
    }

    res.status(200).json({ message: "Coupon updated successfully!", coupon: updatedCoupon })
  } catch (error) {
    console.error("Error updating coupon:", error)
    res.status(500).json({ message: "Internal server error." })
  }
}

const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.query.id

    if (!couponId) {
      return res.status(400).json({ message: "Coupon ID is required." })
    }

    const deletedCoupon = await Coupon.findByIdAndDelete(couponId)

    if (!deletedCoupon) {
      return res.status(404).json({ message: "Coupon not found." })
    }

    if (req.session.appliedCoupon === deletedCoupon.name) {
      req.session.appliedCoupon = null
    }

    res.status(200).json({ message: "Coupon deleted successfully!" })
  } catch (error) {
    console.error("Error deleting coupon:", error)
    res.status(500).json({ message: "Internal server error." })
  }
}

const applyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body
    const userId = req.user._id // Ensure userId is coming from the auth middleware

    console.log("User ID from session:", userId) // Log user ID to check

    // Case-insensitive coupon search
    const coupon = await Coupon.findOne({
      name: { $regex: new RegExp(`^${couponCode}$`, "i") },
    })

    if (!coupon) {
      return res.status(400).json({ message: "Invalid coupon code." })
    }

    const alreadyUsed = await Order.exists({ userId, couponCode: { $regex: new RegExp(`^${couponCode}$`, "i") } })

    if (alreadyUsed) {
      return res.status(400).json({ message: "Coupon already used in a previous order." })
    }

    req.session.appliedCoupon = coupon.name // Store the actual coupon name from DB
    res.status(200).json({ message: "Coupon applied successfully!", discount: coupon.offerPrice })
  } catch (error) {
    console.error("Error applying coupon:", error)
    res.status(500).json({ message: "Internal server error." })
  }
}

module.exports = {
  loadCoupon,
  createCoupon,
  editCoupon,
  deleteCoupon,
  applyCoupon,
}
