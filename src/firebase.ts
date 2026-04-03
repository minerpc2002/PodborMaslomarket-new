import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use the database ID from config, or default to '(default)'
const databaseId = firebaseConfig.firestoreDatabaseId || '(default)';

export const db = getFirestore(app, databaseId);
export const auth = getAuth(app);

// Test connection to Firestore
async function testConnection() {
  console.log("Starting Firestore connection test with database ID:", databaseId);
  try {
    // Attempt to get a document from the server to verify connectivity
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    console.warn("Firestore connection test result:", error.message);
    if (error.message.includes('the client is offline') || error.message.includes('unavailable')) {
      console.error("CRITICAL: Firebase connection failed. This might be due to an incorrect database ID or network issues.");
    }
  }
}
testConnection();
