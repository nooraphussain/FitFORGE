const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Load wallet page
const loadWallet = async (req, res) => {
  try {
    const userId = req.session.user;
    const user = await User.findById(userId);
    
    if (!user) return res.redirect('/login');

    const transactions = user.wallet.transactions.sort((a, b) => b.date - a.date);
    
    res.render('user/wallet', {
      user,
      transactions,
      walletBalance: Number(user.wallet?.balance || 0),
      title: 'My Wallet'
    });
  } catch (error) {
    console.error('Wallet load error:', error);
    res.status(500).render('user/error', { 
      message: 'Wallet load failed', 
      error: error.message 
    });
  }
};

const createWalletOrder = async (req, res) => {
    try {
      const { amount } = req.body;
      const amountNum = parseFloat(amount);
  
      if (!amountNum || amountNum <= 0 || amountNum > 100000) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid amount (1-100000 INR allowed)' 
        });
      }
  
      const options = {
        amount: Math.round(amountNum * 100),
        currency: 'INR',
        receipt: `wallet_${uuidv4().split('-').join('').slice(0, 8)}`,
        payment_capture: 1
      };
  
      const order = await razorpay.orders.create(options);
      
      res.json({
        success: true,
        order,
        key_id: process.env.RAZORPAY_KEY_ID,
        amount: options.amount
      });
    } catch (error) {
      console.error('Order creation error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.error?.description || 'Payment gateway error' 
      });
    }
};

const verifyWalletPayment = async (req, res) => {
    try {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount } = req.body;
      
      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        return res.status(400).json({ 
          success: false, 
          message: 'Missing payment information' 
        });
      }

      const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
      const generatedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(payload)
        .digest('hex');
  
  
      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ 
          success: false, 
          message: 'Payment verification failed: Invalid signature' 
        });
      }
  
      // Update user wallet
      const userId = req.session.user;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'User not authenticated' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      const creditAmount = parseFloat(amount) / 100;
      
      // Ensure wallet structure exists
      if (!user.wallet) {
        user.wallet = { balance: 0, transactions: [] };
      }

      user.wallet.balance = (user.wallet.balance || 0) + creditAmount;
      user.wallet.transactions.push({
        type: 'credit',
        amount: creditAmount,
        description: 'Wallet recharge',
        date: new Date(),
        paymentId: razorpay_payment_id
      });
  
      await user.save();
  
      res.json({
        success: true,
        message: `₹${creditAmount.toFixed(2)} added successfully!`,
        newBalance: user.wallet.balance
      });
    } catch (error) {
      console.error('Payment verification error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Payment verification failed: ' + (error.message || 'Unknown error')
      });
    }
};
  
// Process wallet payment
const processWalletPayment = async (req, res) => {
  try {
    const { totalAmount } = req.body;
    const userId = req.session.user;
    
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (!user.wallet || user.wallet.balance < totalAmount) {
      return res.status(400).json({ 
        success: false, 
        message: `Insufficient balance. Required: ₹${totalAmount}, Available: ₹${user.wallet?.balance || 0}` 
      });
    }

    user.wallet.balance -= totalAmount;
    user.wallet.transactions.push({
      type: 'debit',
      amount: totalAmount,
      description: 'Order payment',
      date: new Date(),
      transactionId: uuidv4()
    });

    await user.save();

    res.json({
      success: true,
      message: 'Payment processed successfully',
      newBalance: user.wallet.balance
    });
  } catch (error) {
    console.error('Wallet payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Payment processing failed: ' + (error.message || 'Unknown error')
    });
  }
};

// Get wallet balance
const getWalletBalance = async (req, res) => {
  try {
    const user = await User.findById(req.session.user);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    res.json({ 
      success: true, 
      balance: user.wallet?.balance || 0
    });
  } catch (error) {
    console.error('Balance check error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Balance check failed: ' + (error.message || 'Unknown error')
    });
  }
};

module.exports = {
  loadWallet,
  createWalletOrder,
  verifyWalletPayment,
  processWalletPayment,
  getWalletBalance
};