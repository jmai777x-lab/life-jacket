// Life Jacket - Firebase configuration holder.
//
// This file ships EMPTY on purpose. Until a real Firebase project exists,
// the app runs its cloud step in a clearly labeled local simulation
// (see cloud.js). Nothing in this file is a secret: Firebase web config
// values are project identifiers, and the app never stores user data
// on any server.
//
// To connect the real cloud step later:
//   1. Create a Firebase project (console.firebase.google.com).
//   2. Copy the web app config values into the object below.
//   3. Reload the page. cloud.js will detect the config and use
//      Firebase AI Logic for explanations.

window.LIFEJACKET_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCYVnbcxSBq3JsbXKT4qknNG4syoncADxw",
  authDomain: "life-jacket-f6c3e.firebaseapp.com",
  projectId: "life-jacket-f6c3e",
  storageBucket: "life-jacket-f6c3e.firebasestorage.app",
  messagingSenderId: "177007788972",
  appId: "1:177007788972:web:e5a4eb9f534be49f7a7009"
};

// Example of the shape, once a project exists:
// window.LIFEJACKET_FIREBASE_CONFIG = {
//   apiKey: "AIza...",
//   authDomain: "your-project.firebaseapp.com",
//   projectId: "your-project",
//   appId: "1:000000000000:web:xxxxxxxxxxxx"
// };
