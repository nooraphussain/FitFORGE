const Order = require('../../models/orderSchema');
const Address = require('../../models/addressSchema'); 
const moment = require('moment');

const loadOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = 8; 
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments(); 
        const totalPages = Math.ceil(totalOrders / limit); 

        const orders = await Order.find({})
            .sort({ createdOn: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.render('admin/adm-orders', {
            orders,
            moment,
            currentPage: page,
            totalPages,
            itemsPerPage: limit // Pass limit as itemsPerPage
        });
    } catch (error) {
        console.error("Error loading admin orders:", error);
        res.redirect('/admin/pageError');
    }
};

const loadOrderDetailsAdmin = async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = await Order.findOne({ orderId })
      .populate({
        path: 'orderedItems.product',
        model: 'Product',
        select: 'productName salePrice regularPrice productImage color brand'
      })
      .populate({
        path: 'userId',
        model: 'User',
        select: 'email name'
      })
      .lean();

    if (!order) {
      return res.redirect('/admin/pageError');
    }

    // Query Address document where the "address" array contains an element with _id equal to order.address
    let addressDoc = await Address.findOne({ "address._id": order.address }).lean();
    let addr = null;
    if (addressDoc && addressDoc.address && addressDoc.address.length > 0) {
      addr = addressDoc.address.find(a => a._id.toString() === order.address.toString());
    }

    const formattedOrder = {
      orderId: order.orderId,
      orderNumber: order._id.toString().slice(-6).toUpperCase(),
      orderDate: moment(order.createdOn).format('ddd MMM DD, YYYY'),
      status: order.status,
      totalAmount: order.totalPrice,
      finalAmount: order.finalAmount,
      paymentMethod: order.paymentMethod || 'COD',
      products: order.orderedItems.map(item => ({
        id: item._id.toString(),
        name: item.product.productName,
        price: item.price,
        quantity: item.quantity,
        total: item.price * item.quantity,
        status: item.status || 'Pending',
        returnReason: item.returnReason || null, // Include return reason
        image: (item.product.productImage && item.product.productImage.length > 0)
                  ? item.product.productImage[0]
                  : 'default-image.jpg',
        color: item.product.color,
        brand: item.product.brand,
        regularPrice: item.product.regularPrice
      })),
      email: order.userId?.email || 'N/A',
      address: addr
                ? ` ${addr.addressLine}, ${addr.city}, ${addr.state} - ${addr.pincode}`
                : 'Address not available',
      pincode: addr && addr.pincode ? addr.pincode : 'N/A',
      phone: addr && addr.phone ? addr.phone : 'Phone not available'
    };

    res.render('admin/adm-orderDetails', { order: formattedOrder, user: order.userId, moment });
  } catch (error) {
    console.error("Error while loading admin order detail page:", error);
    res.redirect('/admin/pageError');
  }
};
  
const updateOrderStatus = async (req, res) => {
    try {
      const { orderId, status } = req.body;
      // Allowed statuses for validation
      const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Return Processing', 'Return Denied', 'Returned'];
      if (!allowedStatuses.includes(status)) {
        return res.json({ success: false, message: "Invalid status" });
      }
      
      const order = await Order.findOne({ orderId: orderId });
      
      if (!order) {
        return res.json({ success: false, message: "Order not found" });
      }
      
      order.status = status;
      
      // Update all product statuses to match the order status
      order.orderedItems.forEach(item => {
        item.status = status;
      });
      
      await order.save();
      
      return res.json({ 
        success: true, 
        message: "Order status updated successfully", 
        order: order.toObject() 
      });
    } catch (error) {
      console.error("Error updating order status:", error);
      return res.json({ success: false, message: "Failed to update order status" });
    }
};

const updateProductStatus = async (req, res) => {
    try {
        const { orderId, productId, status } = req.body;
        
        // Allowed statuses for validation
        const allowedStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Return Request', 'Return Processing', 'Return Denied', 'Returned'];
        if (!allowedStatuses.includes(status)) {
            return res.json({ success: false, message: "Invalid status" });
        }
        
        const order = await Order.findOne({ orderId: orderId });
        
        if (!order) {
            return res.json({ success: false, message: "Order not found" });
        }
        
        const productItem = order.orderedItems.find(item => item._id.toString() === productId);
        
        if (!productItem) {
            return res.json({ success: false, message: "Product not found in order" });
        }
        
        // Update the product status
        productItem.status = status;
        
        // Check if all products have the same status
        const allSameStatus = order.orderedItems.every(item => item.status === status);
        
        // If all products have the same status, update the order status too
        if (allSameStatus) {
            order.status = status;
        }
        
        await order.save();
        
        return res.json({ 
            success: true, 
            message: "Product status updated successfully", 
            orderStatus: order.status,
            allSameStatus: allSameStatus
        });
    } catch (error) {
        console.error("Error updating product status:", error);
        return res.json({ success: false, message: "Failed to update product status" });
    }
};


const handleReturnRequest = async (req, res) => {
  try {
      const { orderId, productId, action } = req.body;
      
      if (!orderId || !productId || !action) {
          return res.json({ success: false, message: "Missing required parameters" });
      }
      
      if (action !== 'confirm' && action !== 'deny') {
          return res.json({ success: false, message: "Invalid action" });
      }
      
      const order = await Order.findOne({ orderId });
      
      if (!order) {
          return res.json({ success: false, message: "Order not found" });
      }
      
      const productItem = order.orderedItems.find(item => item._id.toString() === productId);
      
      if (!productItem) {
          return res.json({ success: false, message: "Product not found in order" });
      }
      
      if (productItem.status !== 'Return Request') {
          return res.json({ success: false, message: "Product is not in Return Request status" });
      }
      
      if (action === 'confirm') {
          productItem.status = 'Return Processing';
      } else {
          productItem.status = 'Return Denied';
      }
      
      // Check if all products have the same status
      const allSameStatus = order.orderedItems.every(item => item.status === productItem.status);
      
      // If all products have the same status, update the order status too
      if (allSameStatus) {
          order.status = productItem.status;
      }
      
      await order.save();
      
      return res.json({ 
          success: true, 
          message: action === 'confirm' ? "Return request confirmed" : "Return request denied", 
          newStatus: productItem.status,
          orderStatus: order.status
      });
  } catch (error) {
      console.error("Error handling return request:", error);
      return res.json({ success: false, message: "Failed to process return request" });
  }
};

module.exports = {
  loadOrders,
  loadOrderDetailsAdmin,
  updateOrderStatus,
  updateProductStatus,
  handleReturnRequest
};