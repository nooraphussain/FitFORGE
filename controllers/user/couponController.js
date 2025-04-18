const Coupon = require("../../models/couponSchema");

const applyCoupon = async (req, res) => {
    try {
      const { code, total, discount: currentDiscount } = req.body;
      const userId = req.session.user; 
  
      // Find the coupon by its code (assuming 'name' stores the coupon code)
      const coupon = await Coupon.findOne({ name: code });
      if (!coupon) {
        return res.status(400).json({ error: true, message: "Invalid coupon" });
      }
      
      // Check if the total meets the coupon's minimum spending requirement
      if (total < coupon.minimumPrice) {
        return res.status(400).json({ error: true, message: `This coupon requires a minimum of $${coupon.minimumPrice} spent` });
      }
      
      // Check if this user has already used the coupon
      if (coupon.usedBy && coupon.usedBy.some(id => id.toString() === userId)) {
        return res.status(400).json({ error: true, message: "Coupon already used" });
      }
      
      // Mark this coupon as used by this user
      coupon.usedBy = coupon.usedBy || [];
      coupon.usedBy.push(userId);
      await coupon.save();
      
      // Calculate new discount and new total
      const newDiscount = (currentDiscount || 0) + coupon.offerPrice;
      req.session.offerPrice = newDiscount;
      const newTotal = total - coupon.offerPrice;
      
      return res.status(200).json({ 
        error: false, 
        message: "Coupon applied successfully!", 
        discount: newDiscount, 
        total: newTotal 
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: true, message: "Internal server error" });
    }
  };
  
module.exports = {
    applyCoupon
};
  