const { onCall, HttpsError } =
  require("firebase-functions/v2/https");

const { initializeApp } =
  require("firebase-admin/app");

const { getFirestore, FieldValue } =
  require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();
const REGION = "asia-south1";

const SIGNUP_BONUS = 1000;
const DAILY_BONUS = 50;
const SOLO_ENTRY_FEE = 100;

// Create wallet and give signup bonus only once.
exports.initializeWallet = onCall({ region: REGION }, async request => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login first.");
  }

  const uid = request.auth.uid;

  const wallet = db.collection("wallets").doc(uid);
  const transaction = db.collection("coinTransactions")
    .doc(`signup_${uid}`);

  let created = false;

  await db.runTransaction(async tx => {
    const existing = await tx.get(wallet);

    if (existing.exists) return;

    tx.create(wallet, {
      uid,
      balance: SIGNUP_BONUS,
      createdAt: FieldValue.serverTimestamp()
    });

    tx.create(transaction, {
      uid,
      type: "signup_bonus",
      amount: SIGNUP_BONUS,
      createdAt: FieldValue.serverTimestamp()
    });

    created = true;
  });

  return {
    success: true,
    message: created
      ? "1000 signup coins added!"
      : "Wallet ready!"
  };
});

// Daily bonus: once per UTC calendar day.
exports.claimDailyBonus = onCall({ region: REGION }, async request => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login first.");
  }

  const uid = request.auth.uid;
  const today = new Date().toISOString().slice(0, 10);

  const wallet = db.collection("wallets").doc(uid);
  const claim = db.collection("dailyClaims")
    .doc(`${uid}_${today}`);

  const transaction = db.collection("coinTransactions")
    .doc(`daily_${uid}_${today}`);

  await db.runTransaction(async tx => {
    const walletDoc = await tx.get(wallet);
    const claimDoc = await tx.get(claim);

    if (!walletDoc.exists) {
      throw new HttpsError(
        "failed-precondition",
        "Wallet not ready. Refresh and try again."
      );
    }

    if (claimDoc.exists) {
      throw new HttpsError(
        "already-exists",
        "You already claimed today's bonus."
      );
    }

    const balance = Number(walletDoc.data().balance || 0);

    tx.update(wallet, {
      balance: balance + DAILY_BONUS,
      updatedAt: FieldValue.serverTimestamp()
    });

    tx.create(claim, {
      uid,
      date: today,
      amount: DAILY_BONUS
    });

    tx.create(transaction, {
      uid,
      type: "daily_bonus",
      amount: DAILY_BONUS,
      createdAt: FieldValue.serverTimestamp()
    });
  });

  return {
    success: true,
    message: "50 daily coins added!"
  };
});

// Solo tournament registration and coin deduction.
exports.joinSoloTournament = onCall(
  { region: REGION },
  async request => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Login first.");
    }

    const uid = request.auth.uid;
    const tournamentId = request.data?.tournamentId;

    if (tournamentId !== "solo-open") {
      throw new HttpsError("invalid-argument", "Invalid tournament.");
    }

    const wallet = db.collection("wallets").doc(uid);

    const tournament = db.collection("tournaments")
      .doc(tournamentId);

    const player = tournament.collection("players").doc(uid);

    const transaction = db.collection("coinTransactions")
      .doc(`entry_${tournamentId}_${uid}`);

    await db.runTransaction(async tx => {
      const [w, t, p] = await Promise.all([
        tx.get(wallet),
        tx.get(tournament),
        tx.get(player)
      ]);

      if (!w.exists || !t.exists) {
        throw new HttpsError(
          "failed-precondition",
          "Wallet or tournament not ready."
        );
      }

      if (p.exists) {
        throw new HttpsError(
          "already-exists",
          "You already joined this tournament."
        );
      }

      const tournamentData = t.data();

      if (
        tournamentData.status !== "open" ||
        tournamentData.mode !== "Solo" ||
        tournamentData.entryFee !== SOLO_ENTRY_FEE
      ) {
        throw new HttpsError(
          "failed-precondition",
          "Tournament is closed or incorrectly configured."
        );
      }

      const count = Number(tournamentData.registeredCount || 0);
      const capacity = Number(tournamentData.maxPlayers || 0);

      if (capacity > 0 && count >= capacity) {
        throw new HttpsError(
          "resource-exhausted",
          "Tournament is full."
        );
      }

      const balance = Number(w.data().balance || 0);

      if (balance < SOLO_ENTRY_FEE) {
        throw new HttpsError(
          "failed-precondition",
          "Not enough coins. Claim your daily bonus."
        );
      }

      tx.update(wallet, {
        balance: balance - SOLO_ENTRY_FEE,
        updatedAt: FieldValue.serverTimestamp()
      });

      tx.update(tournament, {
        registeredCount: count + 1
      });

      tx.create(player, {
        uid,
        tournamentTitle: tournamentData.title || "Solo Battle",
        mode: "Solo",
        entryFee: SOLO_ENTRY_FEE,
        status: "Registered",
        joinedAt: FieldValue.serverTimestamp()
      });

      tx.create(transaction, {
        uid,
        type: "tournament_entry",
        amount: -SOLO_ENTRY_FEE,
        tournamentId,
        createdAt: FieldValue.serverTimestamp()
      });
    });

    return {
      success: true,
      message: "Successfully joined Solo Battle!"
    };
  }
);
