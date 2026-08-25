import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyAdJldm2L-HRChGyu6vpF3SYqBm--RQ9sU",
  authDomain: "kinetiq-3ec44.firebaseapp.com",
  projectId: "kinetiq-3ec44",
  storageBucket: "kinetiq-3ec44.firebasestorage.app",
  messagingSenderId: "1043474090428",
  appId: "1:1043474090428:web:19bb670e0e2ab1486b03b9",
  measurementId: "G-M7781WDNN2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;