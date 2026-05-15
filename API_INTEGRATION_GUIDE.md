# API Integration Guide for External Applications

## Overview
This guide explains how external applications (mobile apps, scanning devices, etc.) can integrate with the Kinetiq Firebase database to save and retrieve user data.

## 🔑 Authentication Methods

### Method 1: Firebase REST API (Recommended for Simple Integration)

#### Get Authentication Token
```bash
curl -X POST \
  'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "vendor@example.com",
    "password": "password123",
    "returnSecureToken": true
  }'
```

Response:
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6...",
  "refreshToken": "...",
  "expiresIn": "3600"
}
```

### Method 2: Firebase Admin SDK (Recommended for Server-Side Apps)

#### Installation
```bash
npm install firebase-admin
```

#### Initialize Admin SDK
```javascript
const admin = require('firebase-admin');
const serviceAccount = require('./path/to/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
```

## 📊 API Endpoints for User Data

### 1. Add New User

#### REST API
```javascript
const addUser = async (userData, authToken) => {
  const response = await fetch(
    'https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          name: { stringValue: userData.name },
          email: { stringValue: userData.email },
          phone: { stringValue: userData.phone },
          vendorEmail: { stringValue: userData.vendorEmail },
          scanCount: { integerValue: 0 },
          createdAt: { stringValue: new Date().toISOString() }
        }
      })
    }
  );
  
  return await response.json();
};

// Usage
addUser({
  name: "John Doe",
  email: "john@example.com",
  phone: "+1234567890",
  vendorEmail: "vendor@example.com"
}, authToken);
```

#### Admin SDK
```javascript
const addUser = async (userData) => {
  const db = admin.firestore();
  
  const userRef = await db.collection('users').add({
    name: userData.name,
    email: userData.email,
    phone: userData.phone,
    vendorEmail: userData.vendorEmail,
    scanCount: 0,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return userRef.id;
};
```

### 2. Get All Users for a Vendor

#### REST API
```javascript
const getUsersByVendor = async (vendorEmail, authToken) => {
  const url = `https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users?filter=vendorEmail EQUAL "${vendorEmail}"`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  return await response.json();
};
```

#### Admin SDK
```javascript
const getUsersByVendor = async (vendorEmail) => {
  const db = admin.firestore();
  
  const snapshot = await db.collection('users')
    .where('vendorEmail', '==', vendorEmail)
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

### 3. Update User Scan Count

#### REST API
```javascript
const updateScanCount = async (userId, newCount, authToken) => {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users/${userId}?updateMask.fieldPaths=scanCount`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          scanCount: { integerValue: newCount }
        }
      })
    }
  );
  
  return await response.json();
};
```

#### Admin SDK
```javascript
const updateScanCount = async (userId, increment = 1) => {
  const db = admin.firestore();
  
  const userRef = db.collection('users').doc(userId);
  
  await userRef.update({
    scanCount: admin.firestore.FieldValue.increment(increment)
  });
};
```

### 4. Get User by Email

#### REST API
```javascript
const getUserByEmail = async (email, authToken) => {
  const url = `https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users?filter=email EQUAL "${email}"`;
  
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  
  const data = await response.json();
  return data.documents?.[0] || null;
};
```

#### Admin SDK
```javascript
const getUserByEmail = async (email) => {
  const db = admin.firestore();
  
  const snapshot = await db.collection('users')
    .where('email', '==', email)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
};
```

## 📱 Integration Examples

### Example 1: Mobile Scanning App (React Native)

```javascript
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

// Initialize Firebase in your app
const FirebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  // ... other config
};

// Add user after scan
const addUserAfterScan = async (scanData) => {
  try {
    // Get current vendor
    const currentUser = auth().currentUser;
    const vendorEmail = currentUser.email;
    
    // Check if user exists
    const userSnapshot = await firestore()
      .collection('users')
      .where('email', '==', scanData.email)
      .get();
    
    if (userSnapshot.empty) {
      // Create new user
      await firestore().collection('users').add({
        name: scanData.name,
        email: scanData.email,
        phone: scanData.phone,
        vendorEmail: vendorEmail,
        scanCount: 1,
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastScan: scanData
      });
    } else {
      // Update existing user
      const userId = userSnapshot.docs[0].id;
      await firestore().collection('users').doc(userId).update({
        scanCount: firestore.FieldValue.increment(1),
        lastScan: scanData
      });
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error adding user:', error);
    return { success: false, error: error.message };
  }
};
```

### Example 2: Python Integration (for scanning devices)

```python
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime

# Initialize Firebase Admin
cred = credentials.Certificate('path/to/serviceAccountKey.json')
firebase_admin.initialize_app(cred)

db = firestore.client()

def add_scan_user(name, email, phone, vendor_email):
    """Add or update user after foot scan"""
    
    # Check if user exists
    users_ref = db.collection('users')
    query = users_ref.where('email', '==', email).limit(1)
    docs = query.stream()
    
    user_doc = None
    for doc in docs:
        user_doc = doc
        break
    
    if user_doc:
        # Update existing user
        user_ref = db.collection('users').document(user_doc.id)
        user_ref.update({
            'scanCount': firestore.Increment(1),
            'lastScanDate': datetime.now()
        })
        return user_doc.id
    else:
        # Create new user
        new_user_ref = db.collection('users').add({
            'name': name,
            'email': email,
            'phone': phone,
            'vendorEmail': vendor_email,
            'scanCount': 1,
            'createdAt': datetime.now(),
            'lastScanDate': datetime.now()
        })
        return new_user_ref[1].id

# Usage
user_id = add_scan_user(
    name="John Doe",
    email="john@example.com",
    phone="+1234567890",
    vendor_email="vendor@kinetiq.com"
)
print(f"User added/updated: {user_id}")
```

### Example 3: Web Application (JavaScript)

```javascript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, increment } from 'firebase/firestore';

const firebaseConfig = {
  // Your config
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

class UserService {
  async addOrUpdateUser(userData) {
    try {
      // Check if user exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', userData.email));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        // Add new user
        const docRef = await addDoc(usersRef, {
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          vendorEmail: userData.vendorEmail,
          scanCount: 1,
          createdAt: new Date().toISOString()
        });
        return { success: true, userId: docRef.id, isNew: true };
      } else {
        // Update existing user
        const userDoc = querySnapshot.docs[0];
        await updateDoc(userDoc.ref, {
          scanCount: increment(1)
        });
        return { success: true, userId: userDoc.id, isNew: false };
      }
    } catch (error) {
      console.error('Error:', error);
      return { success: false, error: error.message };
    }
  }
  
  async getUsersByVendor(vendorEmail) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('vendorEmail', '==', vendorEmail));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }
}

// Usage
const userService = new UserService();

// Add user after scan
await userService.addOrUpdateUser({
  name: "Jane Smith",
  email: "jane@example.com",
  phone: "+1234567890",
  vendorEmail: "vendor@kinetiq.com"
});

// Get all users for vendor
const users = await userService.getUsersByVendor("vendor@kinetiq.com");
console.log(users);
```

## 🔒 Security Best Practices

### 1. Firestore Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Vendors can only read/write their own document
    match /vendors/{vendorId} {
      allow read: if request.auth != null;
      allow write: if request.auth.token.email == resource.data.email;
    }
    
    // Users can only be created/read by authenticated vendors
    match /users/{userId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null && 
                       request.auth.token.email == resource.data.vendorEmail;
      allow delete: if false; // Prevent deletion from external apps
    }
  }
}
```

### 2. API Key Restrictions

In Firebase Console:
1. Go to APIs & Services > Credentials
2. Click on your API key
3. Set restrictions:
   - Application restrictions: HTTP referrers or IP addresses
   - API restrictions: Only allow Firestore API

### 3. Use Environment Variables

Never hardcode API keys in your application:

```javascript
// .env file
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id

// In code
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  // ...
};
```

## 📊 Data Validation

Always validate data before sending to Firebase:

```javascript
const validateUserData = (userData) => {
  const errors = [];
  
  if (!userData.name || userData.name.length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  
  if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
    errors.push('Valid email is required');
  }
  
  if (!userData.phone || !/^\+?[\d\s-()]+$/.test(userData.phone)) {
    errors.push('Valid phone number is required');
  }
  
  if (!userData.vendorEmail) {
    errors.push('Vendor email is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

// Usage
const validation = validateUserData(userData);
if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  return;
}
```

## 🧪 Testing

### Test API Integration

```javascript
// test.js
const testApiIntegration = async () => {
  console.log('Testing Kinetiq API Integration...');
  
  // Test 1: Add user
  const result1 = await userService.addOrUpdateUser({
    name: "Test User",
    email: "test@example.com",
    phone: "+1234567890",
    vendorEmail: "vendor@kinetiq.com"
  });
  console.log('✓ User added:', result1);
  
  // Test 2: Get users by vendor
  const users = await userService.getUsersByVendor("vendor@kinetiq.com");
  console.log('✓ Users retrieved:', users.length);
  
  // Test 3: Update scan count
  if (result1.userId) {
    await updateScanCount(result1.userId, 1);
    console.log('✓ Scan count updated');
  }
  
  console.log('All tests passed!');
};

testApiIntegration();
```

## 📞 Support

For integration support:
- Firebase Documentation: https://firebase.google.com/docs
- Firestore REST API: https://firebase.google.com/docs/firestore/use-rest-api
- Admin SDK Documentation: https://firebase.google.com/docs/admin/setup

---

**Note**: Replace `YOUR_PROJECT_ID` and `YOUR_API_KEY` with your actual Firebase project credentials.
