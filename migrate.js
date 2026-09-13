import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

const oldConfig = {
  apiKey: "AIzaSyD6aXX_1ouL3NQKjZcFpxaNtkp45sOwF_w",
  authDomain: "milkylush-eb570.firebaseapp.com",
  projectId: "milkylush-eb570",
  storageBucket: "milkylush-eb570.firebasestorage.app",
  messagingSenderId: "559251744424",
  appId: "1:559251744424:web:53f9b9b951ec71e405c49d"
};

const newConfig = {
  apiKey: "AIzaSyBLLmjVTiJ8uKlrSiy4A6yUjVbzgSqMR6g",
  authDomain: "milkylush-8f110.firebaseapp.com",
  projectId: "milkylush-8f110",
  storageBucket: "milkylush-8f110.firebasestorage.app",
  messagingSenderId: "668523107428",
  appId: "1:668523107428:web:4c5565c8ac169fd619bb71"
};

const oldApp = initializeApp(oldConfig, 'oldApp');
const newApp = initializeApp(newConfig, 'newApp');

const oldDb = getFirestore(oldApp);
const newDb = getFirestore(newApp);

const collectionsToMigrate = ['products', 'users', 'orders', 'subscriptions', 'banners', 'delivery_agents'];

async function migrate() {
  console.log('Starting data migration from milkylush-eb570 to milkylush-8f110...');

  for (const collName of collectionsToMigrate) {
    console.log(`\nMigrating collection: ${collName}...`);
    try {
      const snapshot = await getDocs(collection(oldDb, collName));
      if (snapshot.empty) {
        console.log(`  - No documents found in ${collName}.`);
        continue;
      }

      let count = 0;
      for (const document of snapshot.docs) {
        await setDoc(doc(newDb, collName, document.id), document.data());
        count++;
      }
      console.log(`  - Successfully migrated ${count} documents in ${collName}.`);
    } catch (e) {
      console.error(`  - Error migrating collection ${collName}:`, e);
    }
  }

  // Migrate delivery settings
  try {
    console.log('\nMigrating settings/delivery...');
    const oldSettingsDoc = await getDoc(doc(oldDb, 'settings', 'delivery'));
    if (oldSettingsDoc.exists()) {
      await setDoc(doc(newDb, 'settings', 'delivery'), oldSettingsDoc.data());
      console.log('  - Successfully migrated settings/delivery.');
    } else {
      console.log('  - No settings/delivery document found.');
    }
  } catch (e) {
    console.error('  - Error migrating settings/delivery:', e);
  }

  console.log('\nMigration completed successfully!');
  process.exit(0);
}

migrate();
