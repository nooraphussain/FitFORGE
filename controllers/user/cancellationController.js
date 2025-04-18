const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Order = require("../../models/orderSchema");
const { v4: uuidv4 } = require('uuid');

const renderCancellationReasonPage = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { type, itemId } = req.query;
        const userId = req.session.user;

        const order = await Order.findOne({ orderId })
            .populate('orderedItems.product')
            .lean();

        if (!order) {
            return res.redirect('/pageNotFound');
        }

        let products = [];
        if (type === 'item' && itemId) {
            const item = order.orderedItems.find(
              item => item._id.toString() === itemId
            );
            if (item) {
              products = [{
                name: item.product.productName,
                price: item.price,
                image: item.product.productImage[0],
                status: item.status 
              }];
            }
        } else if (type === 'order') {
            products = order.orderedItems.map(item => ({
              name: item.product.productName,
              price: item.price,
              image: item.product.productImage[0],
              status: item.status 
            }));
        }

        res.render('user/cancellationReason', {
            orderId,
            type: type || 'order',
            itemId: itemId || null,
            products,
            user: req.user || null
        });
    } catch (error) {
        console.error("Error rendering cancellation reason page:", error);
        res.redirect('/pageNotFound');
    }
};

const processRefundToWallet = async (userId, amount, description) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            console.error("User not found for refund:", userId);
            return { success: false, message: "User not found" };
        }

        // Ensure wallet structure exists
        if (!user.wallet) {
            user.wallet = { balance: 0, transactions: [] };
        }

        // Add refund amount to wallet balance
        user.wallet.balance = (user.wallet.balance || 0) + amount;
        
        // Add transaction record
        const transactionId = uuidv4();
        user.wallet.transactions.push({
            type: 'credit',
            amount: amount,
            description: description,
            date: new Date(),
            transactionId: transactionId
        });

        await user.save();
        console.log(`Refund of ₹${amount.toFixed(2)} processed to wallet for user ${userId}. New balance: ₹${user.wallet.balance.toFixed(2)}`);
        
        return { 
            success: true, 
            message: `Refund of ₹${amount.toFixed(2)} processed successfully`,
            newBalance: user.wallet.balance,
            transactionId: transactionId,
            processed: true // Add this flag to indicate refund was processed
        };
    } catch (error) {
        console.error("Error processing refund to wallet:", error);
        return { success: false, message: "Failed to process refund", error: error.message };
    }
};

const orderCancel = async (req, res) => {
    try {
        const { orderId } = req.params; 
        console.log("Received Order ID for cancellation:", orderId);

        // Find by custom orderId field (not MongoDB _id)
        const order = await Order.findOne({ orderId }).populate('orderedItems.product'); 
        if (!order) {
            console.error("Order not found for ID:", orderId);
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Debug the order object to see the user ID field
        console.log("Order user ID:", order.userId);

        // Track if any items were actually restocked
        let itemsRestocked = false;
        let totalRefundAmount = 0;

        for (const item of order.orderedItems) {
            if (!item.status || (item.status !== "Delivered" && item.status !== "Cancelled")) {
                console.log(`Processing item for cancellation:`, {
                    productId: item.product._id,
                    quantity: item.quantity,
                    status: item.status
                });
                
                item.status = "Cancelled";
                item.cancellationReason = "Entire order cancelled";
                item.cancelledAt = new Date();
                
                // Calculate refund amount
                totalRefundAmount += item.price * item.quantity;
                
                try {
                    // Use "quantity" field instead of "stock"
                    const product = await Product.findById(item.product._id);
                    if (product) {
                        const oldQuantity = product.quantity;
                        product.quantity += item.quantity;
                        await product.save();
                        
                        console.log(`Restored ${item.quantity} units to product ${item.product._id}. Quantity changed from ${oldQuantity} to ${product.quantity}`);
                        itemsRestocked = true;
                    } else {
                        console.error(`Product not found for ID: ${item.product._id}`);
                    }
                } catch (stockError) {
                    console.error(`Error updating quantity for product ${item.product._id}:`, stockError);
                }
            }
        }

        if (itemsRestocked) {
            order.status = "Cancelled";
            order.cancellationDate = new Date();
            await order.save();
            console.log("Order cancelled and stock updated successfully");
            
            // Process refund if payment method is not COD
            if (order.paymentMethod !== 'COD' && totalRefundAmount > 0) {

                const refundResult = await processRefundToWallet(
                    order.userId.toString(), // Convert to string to ensure it's a valid ID
                    totalRefundAmount,
                    `Refund for cancelled order #${order.orderId}`
                );
                
                if (refundResult.success) {
                    console.log(`Automatic refund processed: ${refundResult.message}`);
                    return res.json({ 
                        success: true, 
                        message: "Order cancelled and refund processed to wallet",
                        refund: {
                            processed: true,
                            amount: totalRefundAmount,
                            newBalance: refundResult.newBalance
                        }
                    });
                } else {
                    console.error("Refund processing failed:", refundResult.message);
                }
            }
        } else {
            console.log("No items needed restocking (all were already delivered or cancelled)");
        }

        res.json({ success: true, message: "Order cancelled and stock updated successfully" });
    } catch (error) {
        console.error("Error while cancelling the order:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId, cancelType, reason } = req.body;

        console.log("Cancel request received:", { orderId, itemId, cancelType });

        const order = await Order.findOne({ orderId }).populate('orderedItems.product');
        if (!order) {
            console.error("Order not found:", orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        console.log("Order user ID:", order.userId);

        if (cancelType === 'item' && itemId) {
            const itemIndex = order.orderedItems.findIndex(
                item => item._id.toString() === itemId
            );

            if (itemIndex === -1) {
                console.error("Item not found in order:", itemId);
                return res.status(404).json({ success: false, message: 'Item not found in order' });
            }

            const item = order.orderedItems[itemIndex];
            
            if (item.status !== 'Cancelled' && item.status !== 'Delivered') {
                item.status = 'Cancelled';
                item.cancelledAt = new Date();
                item.cancellationReason = reason || "No reason provided";
                
                // Calculate refund amount for this item
                const refundAmount = item.price * item.quantity;
                
                try {
                    // Use "quantity" field instead of "stock"
                    const product = await Product.findById(item.product._id);
                    if (product) {
                        const oldQuantity = product.quantity;
                        product.quantity += item.quantity;
                        await product.save();
                        
                        console.log(`Item ${itemId} cancelled. Restored ${item.quantity} units to product ${item.product._id}. Quantity changed from ${oldQuantity} to ${product.quantity}`);
                    } else {
                        console.error(`Product not found for ID: ${item.product._id}`);
                    }
                } catch (stockError) {
                    console.error(`Error updating quantity for product ${item.product._id}:`, stockError);
                }

                let allItemsCancelled = true;
                for (const orderItem of order.orderedItems) {
                    if (orderItem.status !== 'Cancelled' && orderItem.status !== 'Delivered') {
                        allItemsCancelled = false;
                        break;
                    }
                }

                if (allItemsCancelled) {
                    order.status = 'Cancelled';
                    order.cancellationDate = new Date();
                }
                
                await order.save();
                console.log("Order updated after item cancellation");
                
                // Process refund if payment method is not COD
                if (order.paymentMethod !== 'COD' && refundAmount > 0) {

                    const refundResult = await processRefundToWallet(
                        order.userId.toString(), // Convert to string to ensure it's a valid ID
                        refundAmount,
                        `Refund for cancelled item in order #${order.orderId}`
                    );
                    
                    if (refundResult.success) {
                        console.log(`Automatic refund processed: ${refundResult.message}`);
                        return res.json({ 
                            success: true, 
                            message: "Item cancelled and refund processed to wallet",
                            refund: {
                                processed: true,
                                amount: refundAmount,
                                newBalance: refundResult.newBalance
                            }
                        });
                    } else {
                        console.error("Refund processing failed:", refundResult.message);
                    }
                }
            } else {
                console.log(`Item ${itemId} already ${item.status}, no action taken`);
                return res.json({ 
                    success: false, 
                    message: `Item is already ${item.status}` 
                });
            }
        } 
        else if (cancelType === 'order') {
            // Redirect to cancellation reason page for order cancellation
            return res.json({ 
                success: true, 
                redirect: true,
                redirectUrl: `/orders/${orderId}/cancel?type=order`
            });
        }

        return res.json({ success: true, message: 'Cancellation successful' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        return res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
};

const cancelProductInOrder = async (order, productId, reason) => {
    try {
        let found = false;
        let quantityToRestore = 0;
        let refundAmount = 0;
        
        for (const item of order.orderedItems) {
            if (item.product.toString() === productId) {
                found = true;
                
                if (item.status && (item.status === "Delivered" || item.status === "Cancelled")) {
                    continue;
                }

                quantityToRestore = item.quantity;
                refundAmount = item.price * item.quantity;
                item.status = "Cancelled";
                item.cancellationReason = reason || "No reason provided";
                item.cancelledAt = new Date();
            }
        }

        if (!found) return { success: false, message: "Product not found in order" };

        await order.save();

        if (quantityToRestore > 0) {

            const product = await Product.findById(productId);
            if (!product) {
                return { 
                    success: false, 
                    message: "Product not found - stock not updated"
                };
            }
            
            product.quantity += quantityToRestore;
            await product.save();
            console.log(`Restored ${quantityToRestore} units to product ${productId}. New quantity: ${product.quantity}`);
        }
        
        // Process refund if payment method is not COD
        if (order.paymentMethod !== 'COD' && refundAmount > 0) {
            const refundResult = await processRefundToWallet(
                order.user,
                refundAmount,
                `Refund for cancelled product in order #${order.orderId}`
            );
            
            if (refundResult.success) {
                console.log(`Automatic refund processed: ${refundResult.message}`);
                return { 
                    success: true, 
                    message: "Product cancelled successfully and refund processed",
                    updatedOrder: order,
                    refund: {
                        amount: refundAmount,
                        newBalance: refundResult.newBalance
                    }
                };
            } else {
                console.error("Refund processing failed:", refundResult.message);
            }
        }

        return { 
            success: true, 
            message: "Product cancelled successfully",
            updatedOrder: order
        };

    } catch (error) {
        console.error("Error cancelling product:", error);
        return { 
            success: false, 
            message: "Server error during cancellation",
            error: error.message
        };
    }
};

const finalizeCancellation = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { cancelType, itemId, reason, comment } = req.body;

        console.log("Finalizing cancellation:", { orderId, cancelType, itemId, reason, comment });

        const order = await Order.findOne({ orderId }).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        console.log("Order user ID:", order.userId);

        let totalRefundAmount = 0;
        let refundProcessed = false;
        let refundResult = null;

        if (cancelType === 'item' && itemId) {
            // Find the specific item and update its status
            const item = order.orderedItems.find(item => item._id.toString() === itemId);
            if (item) {
                if (item.status !== 'Cancelled' && item.status !== 'Delivered') {
                    item.status = "Cancelled";
                    item.cancellationReason = reason || comment || "No reason provided";
                    item.cancelledAt = new Date();
                    
                    // Calculate refund amount
                    totalRefundAmount = item.price * item.quantity;
                    
                    try {
                        // Use "quantity" field instead of "stock"
                        const product = await Product.findById(item.product._id);
                        if (product) {
                            const oldQuantity = product.quantity;
                            product.quantity += item.quantity;
                            await product.save();
                            
                            console.log(`Item ${itemId} cancelled with reason: ${reason || comment || "No reason provided"}. Restored ${item.quantity} units. Quantity changed from ${oldQuantity} to ${product.quantity}`);
                        } else {
                            console.error(`Product not found for ID: ${item.product._id}`);
                        }
                    } catch (stockError) {
                        console.error(`Error updating quantity for product ${item.product._id}:`, stockError);
                    }
                    
                    // Check if all items are now cancelled or delivered
                    let allItemsCancelled = true;
                    for (const orderItem of order.orderedItems) {
                        if (orderItem.status !== 'Cancelled' && orderItem.status !== 'Delivered') {
                            allItemsCancelled = false;
                            break;
                        }
                    }
                    
                    // If all items are cancelled or delivered, check if any are delivered
                    if (allItemsCancelled) {
                        let anyDelivered = false;
                        for (const orderItem of order.orderedItems) {
                            if (orderItem.status === 'Delivered') {
                                anyDelivered = true;
                                break;
                            }
                        }
                        
                        // Only mark order as cancelled if none are delivered
                        if (!anyDelivered) {
                            order.status = "Cancelled";
                            order.cancellationDate = new Date();
                            console.log(`Order ${orderId} marked as cancelled because all items are cancelled`);
                        }
                    }
                } else {
                    console.log(`Item ${itemId} already ${item.status}, no action taken`);
                    return res.json({ 
                        success: false, 
                        message: `Item is already ${item.status}` 
                    });
                }
            } else {
                console.error(`Item ${itemId} not found in order ${orderId}`);
                return res.status(404).json({ 
                    success: false, 
                    message: "Item not found in order" 
                });
            }
        } else if (cancelType === 'order') {
            // Cancel the entire order
            let allItemsCancelled = true;
            let anyDelivered = false;
            
            for (const item of order.orderedItems) {
                if (item.status === 'Delivered') {
                    anyDelivered = true;
                } else if (item.status !== 'Cancelled') {
                    item.status = "Cancelled";
                    item.cancellationReason = reason || comment || "Entire order cancelled";
                    item.cancelledAt = new Date();
                    
                    // Add to refund amount
                    totalRefundAmount += item.price * item.quantity;
                    
                    try {
                        // Use "quantity" field instead of "stock"
                        const product = await Product.findById(item.product._id);
                        if (product) {
                            const oldQuantity = product.quantity;
                            product.quantity += item.quantity;
                            await product.save();
                            
                            console.log(`Restored ${item.quantity} units to product ${item.product._id}. Quantity changed from ${oldQuantity} to ${product.quantity}`);
                        } else {
                            console.error(`Product not found for ID: ${item.product._id}`);
                        }
                    } catch (stockError) {
                        console.error(`Error updating quantity for product ${item.product._id}:`, stockError);
                    }
                }
            }
            
            // Only mark order as cancelled if no items are delivered
            if (!anyDelivered) {
                order.status = "Cancelled";
                order.cancellationDate = new Date();
                console.log(`Order ${orderId} marked as cancelled`);
            }
            
            console.log(`Order ${orderId} cancellation processed with reason: ${reason || comment || "No reason provided"}`);
        }

        await order.save();
        
        // Process refund if payment method is not COD and there's an amount to refund
        if (order.paymentMethod !== 'COD' && totalRefundAmount > 0) {
            // Fix: Use the correct user ID field from the order
            // The field in the Order schema is "userId" not "user"
            refundResult = await processRefundToWallet(
                order.userId.toString(), // Convert to string to ensure it's a valid ID
                totalRefundAmount,
                `Refund for cancelled ${cancelType === 'item' ? 'item' : 'order'} #${order.orderId}`
            );
            
            if (refundResult.success) {
                console.log(`Automatic refund processed: ${refundResult.message}`);
                refundProcessed = true;
            } else {
                console.error("Refund processing failed:", refundResult.message);
            }
        }
        
        // Redirect to order details page after successful cancellation
        if (req.headers['content-type'] === 'application/json') {
            // If it's an AJAX request, send JSON response
            const response = { 
                success: true, 
                message: "Cancellation processed successfully",
                redirectUrl: `/account/orderDetails/${orderId}`
            };
            
            // Add refund information if processed
            if (refundProcessed) {
                response.refund = {
                    processed: true,
                    amount: totalRefundAmount,
                    newBalance: refundResult.newBalance
                };
            }
            
            res.json(response);
        } else {
            // If it's a form submission, redirect
            res.redirect(`/account/orderDetails/${orderId}`);
        }

    } catch (error) {
        console.error("Error finalizing cancellation:", error);
        
        if (req.headers['content-type'] === 'application/json') {
            res.status(500).json({ 
                success: false, 
                message: "Server error",
                error: error.message
            });
        } else {
            res.redirect('/pageNotFound');
        }
    }
};

const submitReturnRequest = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { itemId, reason, details } = req.body;
        const userId = req.session.user;

        console.log("Return request received:", { orderId, itemId, reason, details });

        const order = await Order.findOne({ orderId });
        if (!order) {
            console.error("Order not found:", orderId);
            return res.status(404).json({ 
                success: false, 
                message: "Order not found" 
            });
        }

        // Find the specific item
        const item = order.orderedItems.find(item => item._id.toString() === itemId);
        if (!item) {
            console.error("Item not found in order:", itemId);
            return res.status(404).json({ 
                success: false, 
                message: "Item not found in order" 
            });
        }

        // Check if item is delivered and can be returned
        if (item.status !== 'Delivered') {
            console.error("Item is not delivered, cannot return:", item.status);
            return res.status(400).json({ 
                success: false, 
                message: "Only delivered items can be returned" 
            });
        }

        // Update item status to Return Request
        item.status = 'Return Request';
        item.cancellationReason = reason || "Return requested by customer";
        item.cancelledAt = new Date();

        await order.save();
        console.log(`Return request submitted for item ${itemId} in order ${orderId}`);

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

const processReturnRefund = async (req, res) => {
    console.log('processReturnRefund function called');
    console.log('Request body:', req.body);

    try {
        const { orderId, itemId } = req.body;
        const userId = req.session.user;

        console.log('Processing refund for returned item:', { orderId, itemId, userId });

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized - User authentication required"
            });
        }

        const order = await Order.findOne({ orderId }).populate('orderedItems.product');
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        const item = order.orderedItems.find(item => item._id.toString() === itemId);
        if (!item) {
            return res.status(404).json({
                success: false,
                message: "Item not found in order"
            });
        }

        // Already refunded check
        if (item.refunded) {
            console.log('Refund already processed for this item');
            return res.status(400).json({
                success: false,
                message: "Refund has already been processed for this item"
            });
        }

        if (item.status !== 'Returned') {
            return res.status(400).json({
                success: false,
                message: "Item is not in Returned status"
            });
        }

        const refundAmount = item.price * item.quantity;

        item.refundProcessedAt = new Date();
        item.refundProcessedBy = userId;
        item.refunded = true; // ✅ NEW: Mark item as refunded

        await order.save();

        // Refund logic only if payment not COD
        if (order.paymentMethod !== 'COD' && refundAmount > 0) {
            const refundResult = await processRefundToWallet(
                order.userId.toString(),
                refundAmount,
                `Refund for returned item in order #${order.orderId}`
            );

            if (refundResult.success) {
                return res.json({
                    success: true,
                    message: "Refund processed to wallet successfully",
                    refund: {
                        processed: true,
                        amount: refundAmount,
                        newBalance: refundResult.newBalance
                    }
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: "Failed to process refund",
                    error: refundResult.message
                });
            }
        }

        return res.json({
            success: true,
            message: "Refund processed successfully"
        });

    } catch (error) {
        console.error("Error processing refund:", error);
        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};



module.exports = {
    cancelOrder,
    renderCancellationReasonPage,
    orderCancel,
    cancelProductInOrder,
    finalizeCancellation,
    submitReturnRequest,
    processReturnRefund
};