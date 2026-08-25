import { initializeApp, getApps } from 'firebase/app';
import { getAuth, setPersistence, inMemoryPersistence } from 'firebase/auth';

/**
 * A second Firebase app used only to create login accounts for vendors and
 * staff.
 *
 * createUserWithEmailAndPassword signs the new user in on whichever app it is
 * called against. Doing that on the default app would silently swap the
 * signed-in admin for the account they just created. This app uses
 * inMemoryPersistence so it never writes to localStorage and never displaces
 * the real session.
 */
const secondaryApp = getApps().find((a) => a.name === 'vendorHelper')
  || initializeApp({
    apiKey: 'AIzaSyAdJldm2L-HRChGyu6vpF3SYqBm--RQ9sU',
    authDomain: 'kinetiq-3ec44.firebaseapp.com',
    projectId: 'kinetiq-3ec44',
    storageBucket: 'kinetiq-3ec44.firebasestorage.app',
    messagingSenderId: '1043474090428',
    appId: '1:1043474090428:web:19bb670e0e2ab1486b03b9',
  }, 'vendorHelper');

export const secondaryAuth = getAuth(secondaryApp);
setPersistence(secondaryAuth, inMemoryPersistence).catch(console.error);

export default secondaryApp;
