# 🎓 sBay - Campus Marketplace Platform

<div align="center">

![sBay Logo](./Frontend/public/logo.png)

**A secure, feature-rich marketplace connecting students and campus communities**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-8.6-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Express](https://img.shields.io/badge/Express-4.19-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io-4.8-010101?logo=socket.io&logoColor=white)](https://socket.io/)

[Features](#-features) • [Tech Stack](#-tech-stack) • [Architecture](#-architecture) • [Installation](#-installation) • [Demo](#-demo)

</div>

---

## 📖 Overview

**sBay** is a full-stack marketplace platform designed specifically for campus communities, enabling students to buy, sell, and trade items safely within their university ecosystems. Built with modern web technologies and production-grade security practices, sBay provides a seamless e-commerce experience with real-time messaging, escrow payments, and location-based discovery.

### 🎯 Key Highlights

- **🔒 Secure Escrow System** - Buyer protection with fund hold until delivery confirmation
- **💬 Real-Time Chat** - WebSocket-based messaging between buyers and sellers
- **🎓 Campus-Focused** - Location-aware product discovery by university and city
- **📱 Progressive Web App** - Installable on mobile devices with offline capabilities
- **👮 Admin Dashboard** - Complete platform management with audit logging
- **📧 Multi-Channel Notifications** - Email and SMS alerts for order updates
- **✅ Seller Verification** - Student ID verification with manual admin review
- **💳 Payment Integration** - Paystack integration for secure transactions

---

## ✨ Features

### For Buyers
- 🔍 **Smart Search** - Full-text search across products with filters by campus, category, and location
- 🔥 **Trending Products** - Algorithm-driven trending section based on views and purchases
- 📍 **Location-Based Discovery** - Find items near your campus or city
- 💬 **In-App Messaging** - Chat directly with sellers (unlocked after purchase)
- ⭐ **Seller Ratings** - Review system to ensure quality transactions
- 🛡️ **Purchase Protection** - Escrow system holds funds until delivery confirmation
- 🔔 **Real-Time Notifications** - Email and SMS updates for order status changes

### For Sellers
- 📦 **Easy Listing Management** - Create listings with multiple images, pricing, and inventory tracking
- 💰 **Subscription Tiers** - Free, Premium, and Business plans with different listing limits
- 📊 **Sales Dashboard** - Track sales, revenue, and inventory in real-time
- ✅ **Verification System** - Build trust with verified seller badges
- 💳 **Flexible Payouts** - Support for Mobile Money (MTN, Vodafone, AirtelTigo) and bank transfers
- 📈 **Analytics** - Monitor product views and performance metrics

### For Administrators
- 👥 **User Management** - Manage buyers, sellers, and admins with role-based access control
- 🏷️ **Product Moderation** - Review, hide, or remove listings
- ✅ **Verification Reviews** - Approve/reject student and seller verification requests
- 📧 **Support Tickets** - Handle customer support inquiries
- 📊 **Analytics Dashboard** - Platform-wide metrics and insights
- 📝 **Audit Logging** - Complete activity tracking for compliance
- ⚙️ **Platform Settings** - Configure fees, features, and system parameters

---

## 🏗️ Architecture

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
├─────────────────────────────────────────────────────────────────┤
│  React 19 + Vite                                                 │
│  • Progressive Web App (PWA)                                     │
│  • Context API State Management                                  │
│  • Socket.io Client for Real-Time Chat                           │
│  • Framer Motion Animations                                      │
│  • Responsive Design (Mobile-First)                              │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTPS / WebSocket
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                      API Layer (Express.js)                      │
├─────────────────────────────────────────────────────────────────┤
│  Authentication & Authorization                                  │
│  • JWT-based auth with HTTP-only cookies                         │
│  • Role-based access control (Buyer, Seller, Admin)              │
│  • OAuth integration (Google)                                    │
│                                                                   │
│  Business Logic                                                   │
│  • Atomic stock management (race-condition safe)                 │
│  • Escrow payment flow with fund holds                           │
│  • Chat access control (purchase-gated)                          │
│  • Multi-channel notifications (Email, SMS)                      │
│                                                                   │
│  Security Middleware                                              │
│  • Helmet.js (Security headers)                                  │
│  • Rate limiting (IP-based)                                      │
│  • MongoDB injection prevention                                  │
│  • Input validation & sanitization                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────┐
│                    Data Layer (MongoDB)                          │
├─────────────────────────────────────────────────────────────────┤
│  Collections:                                                     │
│  • Users (with role, verification, seller profile)               │
│  • Products (with atomic stock updates)                          │
│  • Orders (with escrow state machine)                            │
│  • Chats & Messages                                              │
│  • Support Tickets                                               │
│  • Audit Logs                                                    │
│  • Plans & Settings                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow: Order Processing

```
Buyer                   System                    Seller
  │                       │                         │
  │──1. Add to Cart──────>│                         │
  │                       │                         │
  │──2. Checkout────────> │                         │
  │                       │                         │
  │                       │──3. Check Stock────>    │
  │                       │   (Atomic Update)       │
  │                       │                         │
  │<──4. Payment Page──── │                         │
  │                       │                         │
  │──5. Pay (Paystack)──> │                         │
  │                       │                         │
  │                       │──6. Create Order────>   │
  │                       │   Set Escrow: HELD      │
  │                       │                         │
  │                       │────7. Email & SMS─────> │
  │<──8. Email & SMS───── │     "New Order!"        │
  │   "Order Confirmed"   │                         │
  │                       │                         │
  │──9. Chat Unlocked──> <───Chat Unlocked─────────│
  │                       │                         │
  │                       │<───10. Update Status────│
  │<──11. Status Email─── │     (Processing/Shipped)│
  │                       │                         │
  │──12. Confirm Receipt->│                         │
  │                       │                         │
  │                       │──13. Release Escrow──>  │
  │                       │                         │
  │                       │────14. Email───────────>│
  │                       │     "Payment Released"  │
  │                       ▼                         ▼
```

### Chat Access Control Flow

```
┌─────────────────────────────────────────────────────┐
│            User attempts to send message            │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │  Check: Active Order  │
        │   between users?      │
        └───────┬───────────────┘
                │
        ┌───────▼───────┐
        │      NO       │
        └───────┬───────┘
                │
        ┌───────▼────────────────────────┐
        │  Return 403: Purchase required │
        └────────────────────────────────┘
                
        ┌───────────────┐
        │      YES      │
        └───────┬───────┘
                │
        ┌───────▼─────────────────────┐
        │  Chat unlocked - messages   │
        │  flow via Socket.IO         │
        └─────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| **React 19** | UI library with latest features |
| **Vite 8** | Lightning-fast build tool and dev server |
| **React Router 7** | Client-side routing |
| **Socket.io Client** | Real-time bidirectional communication |
| **Framer Motion** | Smooth animations and transitions |
| **Lucide React** | Modern icon library |
| **Axios** | HTTP client with interceptors |

### Backend
| Technology | Purpose |
|-----------|---------|
| **Node.js 18+** | JavaScript runtime |
| **Express 4** | Web application framework |
| **MongoDB 8.6** | NoSQL database with Atlas cloud hosting |
| **Mongoose** | ODM with schema validation |
| **Socket.io 4.8** | WebSocket server for real-time chat |
| **JWT** | Stateless authentication tokens |
| **Bcrypt** | Password hashing with salt |

### Security & Infrastructure
| Technology | Purpose |
|-----------|---------|
| **Helmet.js** | Security HTTP headers |
| **Express Rate Limit** | DDoS and brute-force protection |
| **Express Mongo Sanitize** | NoSQL injection prevention |
| **HPP** | HTTP parameter pollution protection |
| **CORS** | Cross-origin resource sharing control |
| **Morgan** | HTTP request logging |

### External Services
| Service | Purpose |
|---------|---------|
| **Paystack** | Payment processing for Ghana |
| **Nodemailer** | Email notifications (Gmail SMTP) |
| **Twilio / Africa's Talking** | SMS notifications |
| **Google OAuth** | Social authentication |

---

## 🚀 Installation

### Prerequisites
- Node.js 18 or higher
- MongoDB Atlas account (or local MongoDB)
- Git

### 1️⃣ Clone the Repository

```bash
git clone https://github.com/yourusername/sbay.git
cd sbay
```

### 2️⃣ Backend Setup

```bash
cd Backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your credentials
# Required variables:
# - MONGO_URI (MongoDB connection string)
# - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
# - PAYSTACK_SECRET_KEY
# - EMAIL_USER & EMAIL_PASS (Gmail App Password)
# - GOOGLE_CLIENT_ID (optional, for OAuth)

# Seed initial admin and plans
npm run seed:admin

# Start development server
npm run dev
```

The backend will start on `http://localhost:4000`

### 3️⃣ Frontend Setup

```bash
cd ../Frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env and set:
# VITE_API_URL=http://localhost:4000/api

# Start development server
npm run dev
```

The frontend will start on `http://localhost:5173`

### ⚡ Quick local sandbox (no database or Paystack needed)

```bash
cd Backend
npm run dev:local
```

This boots the real API against a throwaway in-memory MongoDB replica set
(downloaded once by `mongodb-memory-server`, ~600 MB) seeded with sample
listings and test accounts (`buyer@sbay.test`, `ama@sbay.test`,
`kojo@sbay.test`, `admin@sbay.test` — password `sbay-dev-pass`). Nothing
persists between runs. `ENABLE_MOCK_CHECKOUT` is on in this mode so
`/api/orders/checkout` can create orders without Paystack; it is ignored
when `NODE_ENV=production`.

### 4️⃣ Access the Application

- **User App**: http://localhost:5173
- **Admin Panel**: http://localhost:5173/admin
- **API Health**: http://localhost:4000/health

**Default Admin Credentials** (change immediately):
- Email: `admin@example.com`
- Password: `changeme`

---

## 📦 Environment Variables

### Backend (.env)

```env
# Server
NODE_ENV=development
PORT=4000
CORS_ORIGINS=http://localhost:5173

# Database
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/sbay

# Authentication
JWT_SECRET=<generate-secure-64-byte-hex>
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=10

# OAuth
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Payment
PAYSTACK_SECRET_KEY=sk_test_<your-key>
PAYSTACK_PUBLIC_KEY=pk_test_<your-key>
PAYSTACK_CALLBACK_URL=http://localhost:5173/payment-success

# Email (Gmail App Password)
EMAIL_USER=yourapp@gmail.com
EMAIL_PASS=<16-char-app-password>

# SMS (Twilio recommended)
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_PHONE_NUMBER=+1234567890

# Admin Panel Security
ADMIN_API_PREFIX=/api/_panel/control
FRONTEND_URL=http://localhost:5173

# Default Admin (first boot only)
SEED_ADMIN_EMAIL=admin@example.com
SEED_ADMIN_PASSWORD=changeme
SEED_ADMIN_NAME=Platform Admin
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:4000/api
```

---

## 📚 API Documentation

### Authentication Endpoints

```
POST   /api/auth/signup          - Register new user
POST   /api/auth/login           - Login with email/password
POST   /api/auth/google          - Google OAuth login
GET    /api/auth/me              - Get current user profile
POST   /api/auth/logout          - Logout (clear session)
POST   /api/auth/forgot-password - Request password reset
POST   /api/auth/reset-password  - Reset password with token
```

### Product Endpoints

```
GET    /api/products             - List products (with filters)
GET    /api/products/:id         - Get product details
POST   /api/products             - Create listing (seller only)
PATCH  /api/products/:id         - Update listing (seller only)
DELETE /api/products/:id         - Delete listing (seller only)
GET    /api/products/trending    - Get trending products
GET    /api/products/catalog     - Get category tree with counts
```

### Order Endpoints

```
POST   /api/orders               - Create order
GET    /api/orders               - List user orders
GET    /api/orders/:id           - Get order details
PATCH  /api/orders/:id/status    - Update order status (seller)
POST   /api/orders/:id/confirm   - Confirm receipt (buyer)
```

### Chat Endpoints

```
GET    /api/chats                - List user chats
GET    /api/chats/:id            - Get chat with messages
POST   /api/chats                - Create or get chat
```

### Admin Endpoints

```
GET    /api/_panel/control/users        - List all users
PATCH  /api/_panel/control/users/:id    - Update user (restrict, verify, etc.)
GET    /api/_panel/control/products     - List all products
PATCH  /api/_panel/control/products/:id - Moderate product
GET    /api/_panel/control/orders       - List all orders
GET    /api/_panel/control/audit        - Audit log
GET    /api/_panel/control/stats        - Platform statistics
```

> **Note**: Admin endpoints require `role: 'admin'` and are mounted at an obscured prefix for security.

---

## 🎨 Screenshots & Demo

### User Interface

**Home Page**
- Trending products with real-time view counters
- Location-based product discovery
- Featured verified sellers
- Progressive Web App installation prompt

**Product Details**
- Image gallery with zoom
- Seller information and ratings
- One-click chat initiation (after purchase)
- Stock availability and condition badges

**Seller Dashboard**
- Sales analytics and revenue tracking
- Active listings management
- Order fulfillment workflow
- Subscription tier management

### Admin Dashboard

**User Management**
- Buyer, seller, and admin role assignment
- Account restriction with audit trail
- Verification request reviews
- Bulk actions and filtering

**Platform Analytics**
- Total users, orders, and revenue
- Growth charts and trends
- Category performance metrics
- Seller activity monitoring

---

## 🔐 Security Features

### Implementation Highlights

1. **Password Security**
   - Bcrypt hashing with 10 rounds
   - Passwords never stored in plaintext
   - Automatic password hash exclusion from queries

2. **JWT Authentication**
   - HTTP-only cookies (XSS prevention)
   - Secure flag in production (HTTPS-only)
   - 7-day expiration with automatic refresh

3. **Rate Limiting**
   - 120 requests/minute general limit
   - 10 requests/minute for auth endpoints
   - IP-based tracking

4. **Input Validation**
   - Express-validator for all endpoints
   - MongoDB injection prevention
   - XSS sanitization

5. **Race Condition Protection**
   - Atomic stock updates with `findOneAndUpdate`
   - Optimistic locking for orders
   - Transaction support where needed

6. **Audit Logging**
   - All admin actions logged
   - User restrictions tracked
   - Order status changes recorded

---

## 📊 Database Schema

### Core Collections

**Users**
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique, indexed),
  passwordHash: String (select: false),
  role: 'buyer' | 'seller' | 'admin',
  verified: Boolean,
  verification: {
    status: 'unverified' | 'pending' | 'verified' | 'rejected',
    isStudent: Boolean,
    university: String,
    idCardUrl: String
  },
  sellerProfile: {
    storeName: String,
    bio: String,
    rating: Number,
    reviewCount: Number
  },
  subscription: {
    plan: String,
    status: 'active' | 'canceled' | 'expired'
  }
}
```

**Products**
```javascript
{
  _id: ObjectId,
  seller: ObjectId (ref: User),
  title: String,
  description: String,
  price: Number,
  stock: Number,
  sold: Number,
  category: String (indexed),
  images: [String],
  location: String,
  school: String,
  status: 'active' | 'sold_out' | 'hidden' | 'removed',
  views: Number,
  createdAt: Date,
  updatedAt: Date
}
```

**Orders**
```javascript
{
  _id: ObjectId,
  invoiceNumber: String (unique, e.g., "SB-12345678"),
  buyer: ObjectId (ref: User),
  seller: ObjectId (ref: User),
  items: [{
    product: ObjectId,
    title: String,
    price: Number,
    qty: Number
  }],
  total: Number,
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'canceled',
  escrow: {
    status: 'held' | 'released' | 'refunded',
    heldAt: Date,
    releasedAt: Date
  },
  buyerConfirmedReceipt: Boolean,
  timeline: [{
    at: Date,
    actor: ObjectId,
    kind: String,
    detail: String
  }]
}
```

---

## 🧪 Testing

### Manual Testing

```bash
# Backend API tests
cd Backend
npm run dev

# Test health endpoint
curl http://localhost:4000/health

# Test authentication
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Frontend Development

```bash
cd Frontend
npm run dev      # Development server
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint checks
```

---

## 📈 Performance Optimizations

### Frontend
- ✅ Code splitting with React.lazy() for all routes
- ✅ Image lazy loading with native loading="lazy"
- ✅ Service Worker for PWA caching
- ✅ Framer Motion animations optimized for 60fps
- ✅ Debounced search input
- ✅ Virtual scrolling for long lists (future enhancement)

### Backend
- ✅ MongoDB indexes on frequently queried fields
- ✅ Compression middleware for response gzip
- ✅ Connection pooling with Mongoose
- ✅ Pagination for all list endpoints
- ✅ Query projection to reduce payload size
- ✅ Rate limiting to prevent abuse

---

## 🚀 Deployment

### Backend (Railway / Render / Heroku)

1. Create new web service
2. Connect GitHub repository
3. Set environment variables from `.env.example`
4. Deploy from `main` branch
5. Update `CORS_ORIGINS` with frontend URL

### Frontend (Vercel / Netlify)

```bash
cd Frontend
npm run build

# Deploy dist/ folder
# Set environment variable:
# VITE_API_URL=https://your-backend-url.com/api
```

### MongoDB Atlas Setup

1. Create free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Whitelist deployment IP addresses
3. Create database user
4. Copy connection string to `MONGO_URI`

### Production Checklist

- [ ] Change default admin password
- [ ] Generate secure `JWT_SECRET` (64+ bytes)
- [ ] Set production `NODE_ENV=production`
- [ ] Enable HTTPS-only cookies (`JWT_COOKIE_SECURE=true`)
- [ ] Configure real payment keys (Paystack live keys)
- [ ] Set up custom domain
- [ ] Configure email service (Gmail or professional SMTP)
- [ ] Enable SMS provider (Twilio with credits)
- [ ] Set obscure `ADMIN_API_PREFIX`
- [ ] Monitor error logs
- [ ] Set up database backups
- [ ] Configure CDN for static assets

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Code Style
- Follow existing code conventions
- Use ESLint for JavaScript linting
- Write descriptive commit messages
- Add comments for complex logic

---

## 📄 License

This project is licensed under the **ISC License**.

---

## 👨‍💻 Author

**Your Name**
- GitHub: [@yourusername](https://github.com/yourusername)
- LinkedIn: [Your LinkedIn](https://linkedin.com/in/yourprofile)
- Email: your.email@example.com

---

## 🙏 Acknowledgments

- [React](https://reactjs.org/) - UI framework
- [Express](https://expressjs.com/) - Backend framework
- [MongoDB](https://www.mongodb.com/) - Database
- [Socket.io](https://socket.io/) - Real-time engine
- [Paystack](https://paystack.com/) - Payment infrastructure
- [Lucide Icons](https://lucide.dev/) - Beautiful icon library

---

## 📞 Support

For issues and questions:
- 📧 Email: support@sbaygh.com
- 🐛 GitHub Issues: [Report a bug](https://github.com/yourusername/sbay/issues)
- 💬 Discussions: [Start a discussion](https://github.com/yourusername/sbay/discussions)

---

<div align="center">

**Built with ❤️ for campus communities**

⭐ Star this repo if you find it helpful!

</div>
