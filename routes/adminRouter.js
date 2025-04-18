const express = require('express')
const router = express.Router()
const multer = require('multer');
const storage = require('../helpers/multer')
const upload = multer({ dest: 'uploads/' }); 
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const brandController = require('../controllers/admin/brandController')
const orderController = require('../controllers/admin/orderController')
const couponController = require('../controllers/admin/couponController')
const salesReportController = require('../controllers/admin/salesReportController')
const walletController = require("../controllers/admin/walletController");
const { adminAuth} = require('../middlewares/auth')


// login management
router.get('/login', adminController.loadLogin)
router.post('/login', adminController.login)
router.get('/', adminAuth, adminController.loadDashboard)
router.get('/logout', adminController.logout)
router.get('/pageError', adminController.pageError)
// router.get('/adminError',  adminController.pageError);


//customers management
router.get('/customers', adminAuth, adminController.loadUsers);
router.get('/users', adminAuth, customerController.customerInfo)
router.get('/blockCustomer',adminAuth, customerController.customerBlocked)
router.get('/unBlockCustomer',adminAuth, customerController.customerUnBlocked)

// Category Management
router.get('/category', adminAuth, categoryController.categoryInfo)
router.post('/addCategory',adminAuth, categoryController.addCategory)
router.get('/editCategory', adminAuth, categoryController.getEditCategory)
router.post('/editCategory/:id', adminAuth, categoryController.editCategory)
router.get('/listCategory', adminAuth, categoryController.getListCategory)
router.get('/unlistCategory', adminAuth, categoryController.getUnListCategory)

//product management 
router.get('/products', adminAuth, productController.getProducts);
router.get('/products/addProducts', adminAuth, productController.addProducts)
router.post('/addProduct', adminAuth, upload.array('productImage'), productController.addingProduct);

router.post('/edit-product/:id',adminAuth,  productController.addingProduct)
router.get('/editProduct/:id', adminAuth, productController.getEditProduct)
router.post('/editProduct/:id', adminAuth, upload.array('productImage'), productController.editProduct)
router.delete('/delete-image/:productId/:imageIndex', adminAuth, productController.deleteImage);

router.get('/blockProduct',adminAuth,productController.blockProduct)
router.get('/unblockProduct',adminAuth,productController.unblockProduct)
router.get('/deleteProduct', adminAuth, productController.deleteProduct)

//Brand management
router.get('/brand', adminAuth, brandController.getBrandPage)

//Order Management
router.get('/orders', adminAuth, orderController.loadOrders);
router.get('/orderDetails/:id', adminAuth, orderController.loadOrderDetailsAdmin);
router.post('/updateOrderStatus', adminAuth, orderController.updateOrderStatus);
router.post('/updateProductStatus', adminAuth, orderController.updateProductStatus);
router.post('/handleReturnRequest', adminAuth, orderController.handleReturnRequest);

//Coupon Management
router.get('/coupons',adminAuth, couponController.loadCoupon);
router.post('/addCoupon', adminAuth, couponController.createCoupon);
router.put('/editCoupon', adminAuth, couponController.editCoupon);
router.get('/deleteCoupon', adminAuth, couponController.deleteCoupon);

//Report Management
router.get('/sales-report', adminAuth, salesReportController.getSalesReportDashboard);
router.get('/sales-report/download/pdf', adminAuth, salesReportController.downloadSalesReportPDF);
router.get('/sales-report/download/excel', adminAuth, salesReportController.downloadSalesReportExcel);

// Wallet Management
router.get("/wallet", adminAuth, walletController.loadWalletManagement)
router.get("/wallet/transaction/:userId/:transactionId", adminAuth, walletController.getTransactionDetails);
router.get("/wallet/filter", adminAuth, walletController.filterTransactions)
router.get("/wallet/users", adminAuth, walletController.getWalletUsers);
router.get("/wallet/order-details/:orderId", adminAuth, walletController.getOrderDetailsByOrderId)


module.exports = router




