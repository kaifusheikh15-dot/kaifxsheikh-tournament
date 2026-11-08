// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCzKnh-P0rHk42Xn1yBpRdQFgt1wi-pVYc",
  authDomain: "kaifuxsheikh.firebaseapp.com",
  projectId: "kaifuxsheikh",
  storageBucket: "kaifuxsheikh.firebasestorage.app",
  messagingSenderId: "888433633869",
  appId: "1:888433633869:web:16dde5b433ff6ff5f9ca04",
  measurementId: "G-1PYHYF6EVG"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const functions = firebase.app().functions("asia-south1");

const initializeWallet = functions.httpsCallable("initializeWallet");
const claimDailyBonus = functions.httpsCallable("claimDailyBonus");
const joinSoloTournament = functions.httpsCallable("joinSoloTournament");

const $ = id => document.getElementById(id);

$("year").textContent = new Date().getFullYear();

let currentUser = null;
let walletListener = null;
let registrationListener = null;

function showMessage(id, text) {
  $(id).textContent = text || "";
}

function errorMessage(error) {
  return error.message || "Something went wrong. Try again.";
}

function busy(button, state, text = "Please wait...") {
  button.disabled = state;

  if (state) {
    button.dataset.oldText = button.textContent;
    button.textContent = text;
  } else if (button.dataset.oldText) {
    button.textContent = button.dataset.oldText;
    delete button.dataset.oldText;
  }
}

// Google login
$("googleLogin").addEventListener("click", async () => {
  const button = $("googleLogin");
  busy(button, true, "Opening Google...");

  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithRedirect(provider);
  } catch (error) {
    showMessage("loginMessage", errorMessage(error));
    busy(button, false);
  }
});

auth.getRedirectResult().catch(error => {
  showMessage("loginMessage", errorMessage(error));
});

// Player login state
auth.onAuthStateChanged(async user => {
  currentUser = user;

  $("loginPanel").hidden = !!user;
  $("dashboard").hidden = !user;

  if (!user) {
    if (walletListener) walletListener();
    if (registrationListener) registrationListener();
    walletListener = null;
    registrationListener = null;
    return;
  }

  $("playerName").textContent = user.displayName || "Player";

  try {
    await initializeWallet();
  } catch (error) {
    showMessage("tournamentMessage", errorMessage(error));
  }

  const userRef = db.collection("users").doc(user.uid);

  try {
    const profile = await userRef.get();

    if (profile.exists) {
      $("ffName").value = profile.data().ffName || "";
      $("ffUid").value = profile.data().ffUid || "";
    }
  } catch (error) {
    showMessage("profileMessage", errorMessage(error));
  }

  if (walletListener) walletListener();

  walletListener = db.collection("wallets")
    .doc(user.uid)
    .onSnapshot(snapshot => {
      if (snapshot.exists) {
        $("coinBalance").textContent =
          Number(snapshot.data().balance || 0).toLocaleString("en-IN");
      }
    });

  if (registrationListener) registrationListener();

  registrationListener = db.collection("tournaments")
    .doc("solo-open")
    .collection("players")
    .doc(user.uid)
    .onSnapshot(snapshot => {
      const area = $("registrations");
      area.innerHTML = "";

      if (!snapshot.exists) {
        area.textContent = "You have not joined a tournament yet.";
        return;
      }

      const data = snapshot.data();
      const row = document.createElement("div");
      row.className = "registration-item";

      const title = document.createElement("strong");
      title.textContent = data.tournamentTitle || "Solo Battle";

      const status = document.createElement("span");
      status.textContent = data.status || "Registered";

      row.append(title, status);
      area.appendChild(row);
    });
});

// Save Free Fire details
$("saveProfileBtn").addEventListener("click", async () => {
  if (!currentUser) return;

  const name = $("ffName").value.trim();
  const uid = $("ffUid").value.trim();

  if (!name || !/^\d{5,20}$/.test(uid)) {
    showMessage("profileMessage", "Enter name and valid 5-20 digit UID.");
    return;
  }

  const button = $("saveProfileBtn");
  busy(button, true);

  try {
    await db.collection("users").doc(currentUser.uid).set({
      ffName: name,
      ffUid: uid,
      displayName: currentUser.displayName || ""
    }, { merge: true });

    showMessage("profileMessage", "Player details saved!");
  } catch (error) {
    showMessage("profileMessage", errorMessage(error));
  } finally {
    busy(button, false);
  }
});

// Daily 50 coin bonus
$("dailyBonusBtn").addEventListener("click", async () => {
  const button = $("dailyBonusBtn");
  busy(button, true, "Claiming...");

  try {
    const result = await claimDailyBonus();
    showMessage("tournamentMessage", result.data.message);
  } catch (error) {
    showMessage("tournamentMessage", errorMessage(error));
  } finally {
    busy(button, false);
  }
});

// Solo tournament: 100 coins
$("joinSoloBtn").addEventListener("click", async () => {
  if (!confirm("Join Solo Battle for 100 virtual coins?")) return;

  const button = $("joinSoloBtn");
  busy(button, true, "Joining...");

  try {
    const result = await joinSoloTournament({
      tournamentId: "solo-open"
    });

    showMessage("tournamentMessage", result.data.message);
  } catch (error) {
    showMessage("tournamentMessage", errorMessage(error));
  } finally {
    busy(button, false);
  }
});

// Logout
$("logoutBtn").addEventListener("click", () => auth.signOut());
