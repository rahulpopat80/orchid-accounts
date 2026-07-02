// ============================================================
// Firebase Configuration — Orchid Heights Accounting
// Uses Firebase v9 Compat SDK (browser CDN — no npm required)
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyB4xUwieQfSO53mlIa4EXk8EzefFJJZWZg",
  authDomain: "orchid-f2c58.firebaseapp.com",
  projectId: "orchid-f2c58",
  storageBucket: "orchid-f2c58.firebasestorage.app",
  messagingSenderId: "329960611795",
  appId: "1:329960611795:web:70e90240aff5e493f91926",
  measurementId: "G-M338V7JZ38"
};

// Initialize Firebase App
firebase.initializeApp(firebaseConfig);

// Firestore database reference
const db = firebase.firestore();

// Enable offline persistence so the app works without internet.
// synchronizeTabs: true → multiple browser tabs share one Firestore connection.
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn('[Firebase] Offline persistence: multiple tabs open — only first tab has persistence.');
    } else if (err.code === 'unimplemented') {
      console.warn('[Firebase] Offline persistence not supported in this browser.');
    }
  });

// ── Single Firestore document that holds ALL society data ──────────────────
// Structure: orchid_data/main  →  { heads: [], transactions: [], memberDeposits: [], lastUpdated: Timestamp }
const DATA_DOC = db.collection('orchid_data').doc('main');
