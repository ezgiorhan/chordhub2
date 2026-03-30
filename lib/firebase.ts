import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBVPGLG_ISV5YSKNH_noswqeanESy91FsE",
  authDomain: "chordhub-fdccd.firebaseapp.com",
  projectId: "chordhub-fdccd",
  storageBucket: "chordhub-fdccd.firebasestorage.app",
  messagingSenderId: "278362421275",
  appId: "1:278362421275:web:87d24321c86b55a5e8a0be",
  measurementId: "G-PFH2P6CG83"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);