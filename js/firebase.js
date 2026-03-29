/* ═══════════════════════════════════════════════════════
   firebase.js — Firebase init, Auth y Firestore
   Exporta: FirebaseApp (singleton con auth, db, funciones)
   ═══════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const _config = {
  apiKey:            "AIzaSyDtryd_alBvOzWIeqDjQjMYXbSTrL53pio",
  authDomain:        "dndtracker-ac78f.firebaseapp.com",
  projectId:         "dndtracker-ac78f",
  storageBucket:     "dndtracker-ac78f.firebasestorage.app",
  messagingSenderId: "708565457437",
  appId:             "1:708565457437:web:ae7fddca5e6113aa3d44f4"
};

const _app      = initializeApp(_config);
const _auth     = getAuth(_app);
const _db       = getFirestore(_app);
const _provider = new GoogleAuthProvider();


/* ── Auth ── */

async function signIn() {
  // Intentar popup primero; si falla por COOP, caer a redirect
  try {
    return await signInWithPopup(_auth, _provider);
  } catch (e) {
    if (e.code === 'auth/popup-blocked' ||
        e.code === 'auth/popup-closed-by-user' ||
        (e.message && e.message.includes('Cross-Origin-Opener-Policy'))) {
      return signInWithRedirect(_auth, _provider);
    }
    throw e;
  }
}

// Procesar redirect result con top-level await — garantiza que el usuario
// esté disponible antes de que cloud.js registre onAuthStateChanged
const _redirectResult = await getRedirectResult(_auth).catch(() => null);
if (_redirectResult) {
  console.log('[firebase] redirect result procesado:', _redirectResult.user?.email);
}

function signOutUser() {
  return signOut(_auth);
}

function getCurrentUser() {
  return _auth.currentUser;
}

function onAuthChange(callback) {
  return onAuthStateChanged(_auth, callback);
}

/* ── Firestore helpers ── */

function _charRef(uid, charId) {
  return doc(_db, 'users', uid, 'characters', charId);
}

function _charsCol(uid) {
  return collection(_db, 'users', uid, 'characters');
}

function _stripUndefined(obj) {
  return JSON.parse(JSON.stringify(obj, (_, v) => v === undefined ? null : v));
}

async function saveCharCloud(uid, char) {
  const ref = _charRef(uid, char.id);
  const data = { ..._stripUndefined(char), _syncedAt: serverTimestamp() };
  await setDoc(ref, data);
}

async function loadCharCloud(uid, charId) {
  const snap = await getDoc(_charRef(uid, charId));
  if (!snap.exists()) return null;
  const data = snap.data();
  // serverTimestamp no es serializable; convertir a string
  if (data._syncedAt && data._syncedAt.toDate) {
    data._syncedAt = data._syncedAt.toDate().toISOString();
  }
  return data;
}

async function loadAllCharsCloud(uid) {
  const snap = await getDocs(_charsCol(uid));
  const result = {};
  snap.forEach(d => {
    const data = d.data();
    if (data._syncedAt && data._syncedAt.toDate) {
      data._syncedAt = data._syncedAt.toDate().toISOString();
    }
    result[data.id] = data;
  });
  return result;
}

async function deleteCharCloud(uid, charId) {
  await deleteDoc(_charRef(uid, charId));
}

/* ── Exportar singleton ── */
window.FirebaseApp = {
  signIn,
  signOutUser,
  getCurrentUser,
  onAuthChange,
  saveCharCloud,
  loadCharCloud,
  loadAllCharsCloud,
  deleteCharCloud
};
