import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyAgRBzyzdn3EuTmzceeI2HGU5AoY9Bjn64',
  authDomain: 'jobhunting-d4762.firebaseapp.com',
  projectId: 'jobhunting-d4762',
  storageBucket: 'jobhunting-d4762.firebasestorage.app',
  messagingSenderId: '1095118186169',
  appId: '1:1095118186169:web:4f0f3ab47d0bdb0fa7dd68',
  measurementId: 'G-JE81YJV58N',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)