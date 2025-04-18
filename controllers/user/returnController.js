const Order = require("../../models/orderSchema");

const submitReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId, reason, details } = req.body;
        const userId = req.session.user;

        if (!orderId || !itemId) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing required information" 
            });
        }

        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        // Find the specific item
        const item = order.orderedItems.find(item => item._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({ 
                success: false, 
                message: "Item not found in order" 
            });
        }

        // Check if item is delivered and can be returned
        if (item.status !== 'Delivered') {
            return res.status(400).json({ 
                success: false, 
                message: "Only delivered items can be returned" 
            });
        }

        // Update item status to Return Requested
        item.status = 'Return Requested';
        item.returnReason = reason;
        item.returnDetails = details;
        item.returnRequestDate = new Date();

        await order.save();

        return res.json({ 
            success: true, 
            message: "Return request submitted successfully" 
        });
    } catch (error) {
        console.error("Error submitting return request:", error);
        return res.status(500).json({ 
            success: false, 
            message: "Server error", 
            error: error.message 
        });
    }
};

module.exports = {
    submitReturnRequest
};