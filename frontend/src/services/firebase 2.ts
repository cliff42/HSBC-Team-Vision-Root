import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDa1gQyYwBO50KxyhJ862PEcpRSdItGdsw",
  authDomain: "digital-walk-around-project.firebaseapp.com",
  projectId: "digital-walk-around-project",
  storageBucket: "digital-walk-around-project.appspot.com",
  messagingSenderId: "377638839707",
  appId: "1:377638839707:web:c974f4b755c0e431672d3e",
};

// Initialize Firebase
initializeApp(firebaseConfig);
const auth = getAuth();

export function login(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export const logout = () => {
  return signOut(auth)
    .then(() => {
      console.log("user signed out");
    })
    .catch((error) => {
      console.log("error logging out", error);
    });
};
