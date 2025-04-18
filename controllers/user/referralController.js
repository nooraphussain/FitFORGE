const User = require("../../models/userSchema")
const { v4: uuidv4 } = require("uuid")
const mongoose = require("mongoose")

const loadReferrals = async (req, res) => {
  try {
    const userId = req.session.user
    const user = await User.findById(userId)

    if (!user) return res.redirect("/login")

    if (!user.referralCode) {
      user.referralCode = "FITFORGE" + user._id.toString().substring(0, 6).toUpperCase()
      await user.save()
    }

    const referrals = await User.find({
      referredBy: userId,
    })
      .select("name createdAt -_id")
      .lean()

    const formattedReferrals = referrals.map((ref) => ({
      name: ref.name,
      date: ref.createdAt,
    }))

    if (user.referralBalance === undefined) {
      user.referralBalance = 0
      await user.save()
    }

    console.log("User object being passed to template:", {
      id: user._id,
      name: user.name,
      referralBalance: user.referralBalance,
      referralCode: user.referralCode,
    })

    res.render("user/referrals", {
      user: user,
      referrals: formattedReferrals,
      title: "My Referrals",
    })
  } catch (error) {
    console.error("Referrals load error:", error)
    res.status(500).render("user/error", {
      message: "Failed to load referrals",
      error: error.message,
    })
  }
}

const applyReferralCode = async (req, res) => {
  try {
    const { referralCode } = req.body

    if (!referralCode) {
      return res.status(400).json({
        success: false,
        message: "Referral code is required",
      })
    }

    // Find the user who owns this referral code
    const referrer = await User.findOne({ referralCode })

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: "Invalid referral code",
      })
    }

    // Store the referrer ID in session for use after successful signup
    req.session.referrerId = referrer._id.toString()

    res.json({
      success: true,
      message: "Referral code applied successfully",
    })
  } catch (error) {
    console.error("Apply referral error:", error)
    res.status(500).json({
      success: false,
      message: "Failed to apply referral code",
    })
  }
}

const processReferralReward = async (userId, referrerId) => {
  try {
    const session = await mongoose.startSession()
    session.startTransaction()

    try {
      // Get the new user
      const newUser = await User.findById(userId).session(session)
      if (!newUser) throw new Error("User not found")

      // Use the provided referrerId parameter instead of trying to access it from newUser.session
      if (!referrerId) {
        await session.abortTransaction()
        session.endSession()
        return
      }

      // Get the referrer
      const referrer = await User.findById(referrerId).session(session)
      if (!referrer) {
        await session.abortTransaction()
        session.endSession()
        return
      }

      // Update the new user to mark as referred and link to referrer
      newUser.referredBy = referrerId
      await newUser.save({ session })

      // Add reward to referrer's referral balance
      const REWARD_AMOUNT = 50 // 50 Rs reward

      // Update referral balance - ensure we're using the correct property name
      referrer.referralBalance = (referrer.referralBalance || 0) + REWARD_AMOUNT

      // Add debugging to verify the update
      console.log(`Before save - Referrer ID: ${referrer._id}, Current balance: ${referrer.referralBalance}`)
      await referrer.save({ session })
      console.log(`After save - Referrer ID: ${referrer._id}, Updated balance: ${referrer.referralBalance}`)

      // Commit the transaction
      await session.commitTransaction()
      session.endSession()

      console.log(`Referral reward of ₹${REWARD_AMOUNT} added to user ${referrerId}'s referral balance`)
    } catch (error) {
      await session.abortTransaction()
      session.endSession()
      console.error("Error processing referral reward:", error)
    }
  } catch (error) {
    console.error("Session error in processReferralReward:", error)
  }
}

const redeemReferralEarnings = async (req, res) => {
  try {
    const userId = req.session.user
    const user = await User.findById(userId)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Use the actual referral balance from the user object
    const referralBalance = user.referralBalance || 0

    console.log(`Attempting to redeem balance: ${referralBalance} for user: ${userId}`)

    // Check if balance is at least ₹100
    if (referralBalance < 100) {
      return res.status(400).json({
        success: false,
        message: "You need at least ₹100 in referral balance to redeem",
      })
    }

    try {
      if (!user.wallet) {
        user.wallet = { balance: 0, transactions: [] }
      }

      user.wallet.balance = (user.wallet.balance || 0) + referralBalance

      // Add transaction record
      user.wallet.transactions.push({
        type: "credit",
        amount: referralBalance,
        description: "Referral earnings redemption",
        date: new Date(),
        transactionId: uuidv4(),
      })

      // Reset referral balance to 0 after redemption
      user.referralBalance = 0

      console.log(`Before save - User wallet: ${user.wallet.balance}, Referral balance: ${user.referralBalance}`)

      // Save the updated user with new wallet balance and reset referral balance
      await user.save()

      console.log(`After save - User wallet: ${user.wallet.balance}, Referral balance: ${user.referralBalance}`)

      res.json({
        success: true,
        message: `₹${referralBalance} has been added to your wallet`,
        newWalletBalance: user.wallet.balance,
      })
    } catch (error) {
      console.error("Error redeeming referral earnings:", error)
      res.status(500).json({
        success: false,
        message: "Failed to redeem referral earnings",
      })
    }
  } catch (error) {
    console.error("Redemption error:", error)
    res.status(500).json({
      success: false,
      message: "An error occurred while processing your request",
    })
  }
}

module.exports = {
  loadReferrals,
  applyReferralCode,
  processReferralReward,
  redeemReferralEarnings,
}

