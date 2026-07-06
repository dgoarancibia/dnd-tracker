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
  onAuthStateChanged,
  browserLocalPersistence,
  setPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  onSnapshot,
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

// Forzar persistencia en localStorage — necesario para Safari/iOS donde
// las cookies de terceros están bloqueadas y se pierde la sesión post-redirect
await setPersistence(_auth, browserLocalPersistence).catch(() => {});

/* ── Auth ── */

// Detectar Safari / iOS — en esos entornos el redirect falla por ITP
function _isSafariOrIOS() {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  // Safari en macOS/iOS — no Chrome ni Firefox
  const isSafariBrowser = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
  return isIOS || isSafariBrowser;
}

async function signIn() {
  await setPersistence(_auth, browserLocalPersistence).catch(() => {});
  if (_isSafariOrIOS()) {
    // Safari / iOS: usar popup para evitar problemas con ITP y cookies de terceros
    console.log('[firebase] Safari/iOS detectado — usando signInWithPopup');
    try {
      const result = await signInWithPopup(_auth, _provider);
      console.log('[firebase] popup login OK:', result.user?.email);
      return result;
    } catch (e) {
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
        // Popup bloqueado o cerrado — fallback a redirect
        console.warn('[firebase] popup bloqueado, fallback a redirect:', e.code);
        return signInWithRedirect(_auth, _provider);
      }
      throw e;
    }
  }
  // Otros navegadores: redirect normal
  return signInWithRedirect(_auth, _provider);
}

// Procesar redirect result con top-level await — para browsers no-Safari
const _redirectResult = await getRedirectResult(_auth).catch(e => {
  console.warn('[firebase] getRedirectResult error:', e.code, e.message);
  return null;
});
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

/* ── Checkpoints (savepoints manuales, subcolección por personaje) ── */

function _checkpointsCol(uid, charId) {
  return collection(_db, 'users', uid, 'characters', charId, 'checkpoints');
}

function _checkpointRef(uid, charId, cpId) {
  return doc(_db, 'users', uid, 'characters', charId, 'checkpoints', cpId);
}

// Guarda un checkpoint. cpId = timestamp ISO (ordenable). Guarda el char completo + label.
async function saveCheckpointCloud(uid, charId, cpId, label, char) {
  const ref = _checkpointRef(uid, charId, cpId);
  const data = {
    id: cpId,
    label: label || '',
    createdAt: cpId,
    char: _stripUndefined(char),
    _syncedAt: serverTimestamp()
  };
  await setDoc(ref, data);
}

// Lista los checkpoints (metadata liviana: id, label, createdAt, y hp/nivel para mostrar).
async function listCheckpointsCloud(uid, charId) {
  const snap = await getDocs(_checkpointsCol(uid, charId));
  const result = [];
  snap.forEach(d => {
    const data = d.data();
    const ch = data.char || {};
    result.push({
      id: data.id,
      label: data.label || '',
      createdAt: data.createdAt,
      hp: ch.hp || null,
      nivel: ch.nivel || null
    });
  });
  // Más recientes primero
  result.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return result;
}

// Trae el char completo de un checkpoint.
async function loadCheckpointCloud(uid, charId, cpId) {
  const snap = await getDoc(_checkpointRef(uid, charId, cpId));
  if (!snap.exists()) return null;
  return snap.data().char || null;
}

async function deleteCheckpointCloud(uid, charId, cpId) {
  await deleteDoc(_checkpointRef(uid, charId, cpId));
}

function listenCharsCloud(uid, onChange, onError) {
  return onSnapshot(_charsCol(uid), snap => {
    const result = {};
    snap.forEach(d => {
      const data = d.data();
      if (data._syncedAt && data._syncedAt.toDate) {
        data._syncedAt = data._syncedAt.toDate().toISOString();
      }
      result[data.id] = data;
    });
    onChange(result);
  }, err => {
    console.error('[firebase] onSnapshot error:', err);
    if (onError) onError(err);
  });
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
  deleteCharCloud,
  listenCharsCloud,
  saveCheckpointCloud,
  listCheckpointsCloud,
  loadCheckpointCloud,
  deleteCheckpointCloud
};
