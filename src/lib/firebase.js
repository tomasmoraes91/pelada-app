// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// Cole aqui os dados do seu projeto: Console Firebase >
// Configurações do projeto > Seus apps > SDK do Firebase.
// ============================================================
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDqEyWQBoL6HvBJx9hseYRlxMxLg6ihesY",
  authDomain: "meucolete-ba954.firebaseapp.com",
  projectId: "meucolete-ba954",
  storageBucket: "meucolete-ba954.firebasestorage.app",
  messagingSenderId: "484214026077",
  appId: "1:484214026077:web:6b390c85212530da6482b4",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();
