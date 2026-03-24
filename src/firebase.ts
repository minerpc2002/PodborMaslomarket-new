import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromCache, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Try to use the provided database ID, but fallback to (default) if it fails
// In many cases, (default) is the correct one even if a named one is provided
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

// Test connection to Firestore
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection successful.");
  } catch (error: any) {
    console.warn("Firestore connection test result:", error.message);
    if (error.message.includes('the client is offline')) {
      console.error("CRITICAL: Firebase configuration might be incorrect or the database is not provisioned yet.");
    }
  }
}
testConnection();
