'use strict';

// Firebase config values are meant to be public in client-side apps.
// Actual access control is enforced by Firestore Security Rules, not by hiding these values.
// https://firebase.google.com/docs/projects/api-keys
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBOAjTK8cy-kb_XPUmh5GEibih98tXjblE',
  authDomain: 'paylog-paypay.firebaseapp.com',
  projectId: 'paylog-paypay',
  storageBucket: 'paylog-paypay.firebasestorage.app',
  messagingSenderId: '496927366032',
  appId: '1:496927366032:web:fd92792a345c84b4747115',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
