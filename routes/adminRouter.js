const express = require('express')
const router = express.Router()
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Configure upload directory
const adminController = require('../controllers/admin/adminController')
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const {userAuth, adminAuth} = require('../middlewares/auth')


// login management

router.get('/login', adminController.loadLogin)
router.post('/login', adminController.login)
router.get('/', adminAuth, adminController.loadDashboard)
router.get('/logout', adminController.logout)
router.get('/pageError', adminController.pageError)


//customer management

router.get('/users', adminAuth, customerController.customerInfo)
router.get('/blockCustomer', adminAuth, customerController.customerBlocked)
router.get('/unBlockCustomer', adminAuth, customerController.customerUnBlocked)

// Category Management

router.get('/category', adminAuth, categoryController.categoryInfo)
router.post('/addCategory', adminAuth, categoryController.addCategory)
router.get('/editCategory', adminAuth, categoryController.getEditCategory)
router.post('/editCategory/:id', adminAuth, categoryController.editCategory)
router.get('/listCategory', adminAuth, categoryController.getListCategory)
router.get('/unlistCategory', adminAuth, categoryController.getUnListCategory)

//product management

// router.get('/addProducts', adminAuth, productController.getProductAddPage)
router.get('/products', adminAuth, productController.getProducts);
router.get('/products/addProducts', adminAuth, productController.addProducts)
// router.post('/add-productt', adminAuth, productController.addingProduct)

router.post('/add-product', adminAuth, upload.array('productImage'), productController.addingProduct);
router.get('/products/editProduct/:id', adminAuth, productController.getEditProduct)
router.post('/update-product/:id', adminAuth, upload.array('productImage'), productController.editProduct)
router.delete('/products/deleteProduct/:id', adminAuth, productController.deleteProduct)
module.exports = router




