# KINETIQ Super Admin Dashboard - Setup Instructions

## 📋 Project Overview
This is a **React + Firebase** Super Admin Dashboard for a foot sole scanning system. It includes vendor/admin management, user management per vendor, and analytics features.

## ⚠️ Important: External Deployment Required
**This application uses Firebase and is designed for EXTERNAL deployment.** The Emergent platform primarily supports FastAPI + MongoDB backends. To use this Firebase-based application:

1. **Download/Export** this code from Emergent
2. **Deploy** on Firebase Hosting, Vercel, Netlify, or similar platforms that support Firebase apps

## 🔧 Firebase Configuration

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" and follow the setup wizard
3. Enable **Authentication** (Email/Password)
4. Enable **Cloud Firestore** database

### Step 2: Get Firebase Config
1. In Firebase Console, go to Project Settings > General
2. Scroll to "Your apps" section
3. Click the web icon (</>) to add a web app
4. Copy the firebaseConfig object

### Step 3: Update Configuration
Replace the dummy config in `/app/frontend/src/config/firebase.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## 📦 Installation

```bash
cd /app/frontend
yarn install
```

## 🚀 Running Locally

```bash
yarn start
```

The app will open at `http://localhost:3000`

## 🏗️ Build for Production

```bash
yarn build
```

## 📤 Deployment Options

### Option 1: Firebase Hosting
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Initialize
firebase init hosting

# Deploy
firebase deploy
```

### Option 2: Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel
```

### Option 3: Netlify
1. Connect your Git repository to Netlify
2. Set build command: `yarn build`
3. Set publish directory: `build`
4. Deploy

## 👥 Initial Setup - Create Default Super Admin

After deployment, you'll need to create the default "Kinetiq" super admin:

1. Go to Firebase Console > Authentication
2. Manually add a user:
   - Email: `Super_admin@kinetiq.com`
   - Password: `yourSecurePassword_Admin`

3. Go to Firebase Console > Firestore
4. Create collection: `vendors`
5. Add document with fields:
   ```json
   {
     "name": "Super Admin",
     "email": "admin@kinetiq.com",
     "companyName": "Kinetiq",
     "phone": "+1234567890",
     "status": "active",
     "createdAt": "2025-01-01T00:00:00.000Z"
   }
   ```

## 🎯 Features

### 1. Vendor/Admin Management
- Register new vendors with email, company name, phone
- Each vendor gets Firebase Authentication account
- List all vendors with search functionality
- Delete vendors

### 2. User Management
- Add users under specific vendors (by vendor email)
- Each user tracked with scan counts
- View all users across system
- View users grouped by vendor

### 3. Analytics Dashboard
- Total vendors, users, scans statistics
- Visual charts for scan trends
- Vendor performance comparison
- Real-time activity indicators

### 4. Login System
- Beautiful purple/pink gradient design
- Email + Password + Company Name authentication
- Password visibility toggle
- Social login buttons (ready for integration)

## 📊 Database Structure

### Collections:

#### `vendors`
```json
{
  "name": "string",
  "email": "string",
  "companyName": "string",
  "phone": "string",
  "status": "active",
  "createdAt": "ISO timestamp"
}
```

#### `users`
```json
{
  "name": "string",
  "email": "string",
  "phone": "string",
  "vendorEmail": "string",
  "scanCount": "number",
  "createdAt": "ISO timestamp"
}
```

## 🔌 API Integration for External Apps

To save user data from external scanning apps, use Firebase Admin SDK or REST API:

### Using REST API:
```javascript
// Add new user from external app
const response = await fetch(
  'https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users',
  {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer YOUR_FIREBASE_TOKEN',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fields: {
        name: { stringValue: "John Doe" },
        email: { stringValue: "john@example.com" },
        phone: { stringValue: "+1234567890" },
        vendorEmail: { stringValue: "vendor@example.com" },
        scanCount: { integerValue: 0 },
        createdAt: { stringValue: new Date().toISOString() }
      }
    })
  }
);
```

## 📄 PDF Generation for Electron App

A separate PDF generator component is provided at:
`/app/frontend/src/components/PDFGenerator.jsx`

### Installation for PDF Generation:
```bash
npm install jspdf jspdf-autotable
```

### Usage:
```javascript
import { PDFGenerator } from './components/PDFGenerator';

// Generate PDF from ChatGPT text
const pdfGen = new PDFGenerator();
pdfGen.generatePDF(
  chatGPTResponse,
  'Report Title',
  {
    author: 'Your Name',
    company: 'Kinetiq',
    date: new Date().toLocaleDateString()
  }
);
```

## 🎨 Design System

- **Primary Color**: Purple (#9333ea)
- **Secondary Color**: Pink (#ec4899)
- **Fonts**: 
  - Headings: Space Grotesk
  - Body: Inter
- **Theme**: Modern gradient with glass-morphism effects

## 🔐 Security Notes

1. Never commit Firebase config with real API keys to public repos
2. Set up Firebase Security Rules in production
3. Enable App Check for additional security
4. Use environment variables for sensitive data

### Example Firestore Security Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Vendors collection - only authenticated users
    match /vendors/{vendorId} {
      allow read, write: if request.auth != null;
    }
    
    // Users collection - only authenticated users
    match /users/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📞 Support

For questions or issues:
- Check Firebase documentation: https://firebase.google.com/docs
- Review React documentation: https://react.dev

## 📝 License

This dashboard is created for Kinetiq foot sole scanning system.

---

**Note**: This is a frontend-only application. All data is stored in Firebase. No backend server is required.
