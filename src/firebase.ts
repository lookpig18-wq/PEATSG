import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithPopup, onAuthStateChanged, signOut, 
  signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword 
} from 'firebase/auth';
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

export { 
  signInWithPopup, onAuthStateChanged, signOut, 
  signInAnonymously, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, onSnapshot, query, where, orderBy, getDocFromServer 
};

// Test connection removed - handled in main.ts
