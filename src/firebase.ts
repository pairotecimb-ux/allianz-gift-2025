// ไฟล์: src/firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// --- เอา Code จาก Firebase Console มาแปะทับตรงนี้ ---
const firebaseConfig = {
  apiKey: 'AIzaSyBTFks9wFzB2wbAGry8MaA80MpRtQNYHJY',
  authDomain: 'allianz-gift2025.firebaseapp.com',
  projectId: 'allianz-gift2025',
  storageBucket: 'allianz-gift2025.firebasestorage.app',
  messagingSenderId: '136732964198',
  appId: '1:136732964198:web:60a240a63a39a9003644a7',
};
// ---------------------------------------------------

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
