import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDsi4vqiJ3Y14asWwHdD7NqlLwKDymAaOE",
  authDomain: "agua-potable-po.firebaseapp.com",
  projectId: "agua-potable-po",
  storageBucket: "agua-potable-po.firebasestorage.app",
  messagingSenderId: "784800778986",
  appId: "1:784800778986:web:dcb1cc0cc02a2e91afa593",
  measurementId: "G-XVL935LZPB"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
