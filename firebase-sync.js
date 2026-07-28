/* global firebase */
(() => {
  'use strict';
  const config = { apiKey: 'AIzaSyAha0heyfw_WnhjG0_ZOmtPWUFBOHpwEto', authDomain: 'homework-15581.firebaseapp.com', databaseURL: 'https://homework-15581-default-rtdb.firebaseio.com', projectId: 'homework-15581', storageBucket: 'homework-15581.firebasestorage.app', messagingSenderId: '721665576212', appId: '1:721665576212:web:473271ea65038e4cdb0601', measurementId: 'G-0BJDEG9TSB' };
  const keys = ['notesHistory','events','theme','subjects','subjectsSelected','notificationsEnabled','language','languageSelected','finishedSubjects','listedTasks'];
  const setItem = localStorage.setItem.bind(localStorage), removeItem = localStorage.removeItem.bind(localStorage);
  let user, dataRef, ready = false, loaded = false, applying = false, lastData = '', stop, timer;
  let resolveReady;
  window.firebaseSyncReady = new Promise(resolve => { resolveReady = resolve; });
  firebase.initializeApp(config);
  const auth = firebase.auth(), database = firebase.database();

  const localData = () => keys.reduce((result, key) => { const value = localStorage.getItem(key); if (value !== null) result[key] = value; return result; }, {});
  // Firebase may return object fields in a different order. Normalize to our
  // fixed key order before comparing, so identical homework never looks like
  // a change from another device.
  const text = value => JSON.stringify(keys.reduce((result, key) => {
    if (Object.prototype.hasOwnProperty.call(value || {}, key)) result[key] = value[key];
    return result;
  }, {}));
  const message = (value, error = false) => { const box = document.getElementById('auth-message'); if (box) { box.textContent = value; box.classList.toggle('error', error); } };
  const apply = data => { applying = true; try { keys.forEach(key => Object.prototype.hasOwnProperty.call(data, key) ? setItem(key, data[key]) : removeItem(key)); } finally { applying = false; } };
  const showApp = account => {
    document.getElementById('auth-gate')?.classList.add('hidden');
    document.getElementById('app')?.classList.remove('auth-locked');
    const label = account.email || account.displayName || 'Account';
    const full = account.displayName || account.email || 'Signed in';
    const buttonLabel = document.getElementById('account-button-label'), accountName = document.getElementById('account-name');
    if (buttonLabel) buttonLabel.textContent = label;
    if (accountName) accountName.textContent = full;
  };
  const showSignIn = () => { document.getElementById('auth-gate')?.classList.remove('hidden'); document.getElementById('app')?.classList.add('auth-locked'); };
  const write = () => {
    if (!ready || applying || !user) return;
    clearTimeout(timer); timer = setTimeout(() => {
      const data = localData(), serialized = text(data);
      if (serialized === lastData) return;

      // Record this version before sending it. Realtime Database immediately
      // sends our own successful write back through the listener; that echo is
      // not a change from another device and must never reload this page.
      lastData = serialized;
      dataRef.set(data).catch(error => {
        lastData = '';
        message(`Could not sync: ${error.message}`, true);
      });
    }, 500);
  };
  localStorage.setItem = (key, value) => { setItem(key, value); if (keys.includes(key)) write(); };
  localStorage.removeItem = key => { removeItem(key); if (keys.includes(key)) write(); };

  function loadUser(account) {
    const wasReady = ready; user = account; loaded = false; dataRef = database.ref(`users/${account.uid}/homeworkData`); stop?.();
    const listener = snapshot => {
      const remote = snapshot.val();
      if (!loaded) {
        if (remote) { apply(remote); lastData = text(remote); } else { const data = localData(); lastData = text(data); dataRef.set(data).catch(error => message(`Could not create cloud backup: ${error.message}`, true)); }
        loaded = true; ready = true; showApp(account); resolveReady(); if (wasReady) window.location.reload(); return;
      }
      const remoteText = text(remote);
      if (remoteText !== lastData) {
        lastData = remoteText;
        apply(remote || {});

        // Never reload while the app is open. The cloud copy is now safely
        // stored locally and will be displayed the next time this page opens.
        // This prevents sync activity from ever interrupting homework typing.
      }
    };
    dataRef.on('value', listener, error => { message(`Could not load cloud data: ${error.message}`, true); if (!ready) { ready = true; resolveReady(); } });
    stop = () => dataRef.off('value', listener);
  }

  function wireUi() {
    const busy = value => document.querySelectorAll('#auth-gate button, #auth-gate input').forEach(element => { element.disabled = value; });
    const emailPassword = () => [document.getElementById('auth-email').value.trim(), document.getElementById('auth-password').value];
    document.getElementById('email-sign-in')?.addEventListener('click', async () => { const [email, password] = emailPassword(); if (!email || !password) return message('Enter your email address and password.', true); busy(true); try { await auth.signInWithEmailAndPassword(email, password); } catch (error) { message(error.message, true); } finally { busy(false); } });
    document.getElementById('email-sign-up')?.addEventListener('click', async () => { const [email, password] = emailPassword(); if (!email || !password) return message('Enter your email address and password.', true); busy(true); try { await auth.createUserWithEmailAndPassword(email, password); } catch (error) { message(error.message, true); } finally { busy(false); } });
    document.getElementById('google-sign-in')?.addEventListener('click', async () => { busy(true); try { await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()); } catch (error) { message(error.message, true); } finally { busy(false); } });
    const toggle = document.getElementById('account-toggle'), menu = document.getElementById('account-menu');
    toggle?.addEventListener('click', event => { event.stopPropagation(); const open = menu.classList.contains('hidden'); menu.classList.toggle('hidden', !open); toggle.setAttribute('aria-expanded', String(open)); });
    document.addEventListener('click', event => { if (menu && !menu.contains(event.target) && !toggle?.contains(event.target)) { menu.classList.add('hidden'); toggle?.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { menu?.classList.add('hidden'); toggle?.setAttribute('aria-expanded', 'false'); } });
    document.getElementById('sign-out')?.addEventListener('click', () => auth.signOut());
  }
  document.addEventListener('DOMContentLoaded', wireUi);

  // Firebase's LOCAL persistence survives page reloads and browser restarts.
  // This is set before observing auth state so the saved session is restored
  // before the sign-in screen is ever shown.
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .catch(error => message(`Could not keep you signed in: ${error.message}`, true))
    .finally(() => {
      auth.onAuthStateChanged(account => {
        if (account) return loadUser(account);
        stop?.();
        user = null;
        dataRef = null;
        if (ready) {
          applying = true;
          keys.forEach(removeItem);
          applying = false;
          window.location.reload();
        } else {
          showSignIn();
          ready = true;
          resolveReady();
        }
      });
    });
})();
