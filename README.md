# 🛍️ FitFORGE – E-commerce Platform 

An elegant and scalable **e-commerce web application** built with Node.js, Express, and MongoDB. Designed for both **customers and administrators**, FitFORGE integrates essential e-commerce features with powerful tools for sales and product management.

---
# Visit the hosted project
https://fitforge.club/

## 🚀 Key Features

- 🔐 **User & Admin Authentication** (Sessions, Bcrypt)
- 🛒 **Shopping Cart & Wishlist**
- 📦 **Product Management** (CRUD with Categories)
- 💳 **Razorpay Payment Integration**
- 🏠 **Address Book Management**
- 🎫 **Coupon System & Referral Program**
- 📊 **Sales Reporting & Analytics**
- 🔄 **Order Return & Refund Management**

---

## 💻 Tech Stack

| Layer     | Technologies                     |
|-----------|----------------------------------|
| Frontend  | EJS, Bootstrap                   |
| Backend   | Node.js, Express                 |
| Database  | MongoDB                          |
| Payments  | Razorpay                         |
| Security  | bcrypt, Sessions                 |

---

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/nooraphussain/FitFORGE.git
cd FitFORGE

# Install backend dependencies
npm install

# Configure environment variables
# (Create a .env file with necessary keys)
PORT=2006
DB_URL=*******
RAZORPAY_KEY_ID=*******
RAZORPAY_KEY_SECRET=*******
CLOUDINARY_CLOUD_NAME=*******
CLOUDINARY_API_KEY=*******
CLOUDINARY_API_SECRET=*******
SESSION_SECRET=*******

# Run development server
nodemon app

```


## 📂 Project Structure

```text
FitFORGE/
├── controllers/     # Business logic
├── models/          # Database schemas
│   ├── userSchema.js
│   ├── productSchema.js
│   └── orderSchema.js #many more such...
├── routes/          # API endpoints
│   ├── adminRoutes.js
│   └── userRoutes.js
├── views/           # EJS templates
├── public/          # Static assets
├── middlewares/     # Authentication
└── app.js        # Application entry

```



## 🌟 Core Functionalities

### 👤 User Module
- Secure registration with email validation
- Google OAuth login
- Login & logout with session handling
- Password reset via email

### 🛠️ Admin Panel
- Dashboard overview
- CRUD operations for categories, products
- Order management & order status updates
- Sales reports and performance graphs

### 🛒 Shopping Flow
- Add/remove products to cart or wishlist
- Address selection and payment checkout
- Real-time order status tracking

### 💰 Financial Operations
- Apply discount coupons
- Referral code benefits

---

## 📸 UI Preview

> Add screenshots or a demo video link here for better engagement

---

## 👨‍💻 Author

**Noora Hussain**  
📧 [noorahussainp2002@gmail.com](mailto:noorahussainp2002@gmail.com)  
🔗 [GitHub Profile](https://github.com/nooraphussain)

---

## 🌟 Show Your Support

If you like this project, consider **starring** ⭐ the repository. Your feedback is always welcome!


