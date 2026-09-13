import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

// MilkyLush Firebase Project Credentials
const firebaseConfig = {
  apiKey: "AIzaSyBLLmjVTiJ8uKlrSiy4A6yUjVbzgSqMR6g",
  authDomain: "milkylush-8f110.firebaseapp.com",
  projectId: "milkylush-8f110",
  storageBucket: "milkylush-8f110.firebasestorage.app",
  messagingSenderId: "668523107428",
  appId: "1:668523107428:web:4c5565c8ac169fd619bb71"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Auth
export const auth = getAuth(app);
export const secondaryAuth = auth;

// Initialize Cloud Firestore and export it
export const db = getFirestore(app);

// Initialize Storage and export it
export const storage = getStorage(app);

