import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBLLmjVTiJ8uKlrSiy4A6yUjVbzgSqMR6g",
  authDomain: "milkylush-8f110.firebaseapp.com",
  projectId: "milkylush-8f110",
  storageBucket: "milkylush-8f110.firebasestorage.app",
  messagingSenderId: "668523107428",
  appId: "1:668523107428:web:4c5565c8ac169fd619bb71"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function clearOrdersAndSubscriptions() {
  console.log('Clearing all orders and subscriptions from Cloud Firestore...');
  
  // Clear orders
  const ordersSnap = await getDocs(collection(db, 'orders'));
  console.log(`Found ${ordersSnap.docs.length} orders.`);
  for (const document of ordersSnap.docs) {
    await deleteDoc(doc(db, 'orders', document.id));
    console.log(`Deleted order ${document.id}`);
  }
  console.log('Successfully deleted all orders.');

  // Clear subscriptions
  const subsSnap = await getDocs(collection(db, 'subscriptions'));
  console.log(`Found ${subsSnap.docs.length} subscriptions.`);
  for (const document of subsSnap.docs) {
    await deleteDoc(doc(db, 'subscriptions', document.id));
    console.log(`Deleted subscription ${document.id}`);
  }
  console.log('Successfully deleted all subscriptions.');

  console.log('Database clean-up finished cleanly!');
  process.exit(0);
}

clearOrdersAndSubscriptions();
