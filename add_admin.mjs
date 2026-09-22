import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBLLmjVTiJ8uKlrSiy4A6yUjVbzgSqMR6g",
  authDomain: "milkylush-8f110.firebaseapp.com",
  projectId: "milkylush-8f110",
  storageBucket: "milkylush-8f110.firebasestorage.app",
  messagingSenderId: "668523107428",
  appId: "1:668523107428:web:4c5565c8ac169fd619bb71"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function addAdmin() {
  // Passed in rather than hardcoded: a committed password is readable by anyone
  // with repo access, and Netlify's secret scanning fails the build over it.
  //   node add_admin.mjs admin@milkylush.com "the-password"
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Usage: node add_admin.mjs <email> <password>');
    process.exit(1);
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("Created user:", user.uid);
    
    await setDoc(doc(db, "admins", user.uid), {
      email: email,
      name: "Super Admin",
      role: "admin",
      createdAt: new Date().toISOString()
    });
    console.log("Added to admins collection.");
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("Admin already exists!");
      // If already exists, just make sure they are in the admins collection
      // but we'd need to log in to get their UID if we don't have it.
    } else {
      console.error("Error creating admin:", error);
    }
    process.exit(1);
  }
}

addAdmin();
