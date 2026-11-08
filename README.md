# KaifXSheikh secure tournament platform

Install Node.js 20+, run `npm install`, copy `.env.example` to `.env`, set a strong SESSION_SECRET, ADMIN_BOOTSTRAP_PASSWORD and your own UPI_ID, then run `npm start`.

ADMIN_EMAIL defaults to kaifusheikh15@gmail.com. The first run seeds this admin only if no account with that email exists. Set a strong unique bootstrap password before first launch.

UPI deposits use manual UTR submission and admin approval; this does not automatically verify bank payments. Deploy behind HTTPS on a persistent host with persistent storage. Back up the SQLite databases. This is source code, not a hosted live website. Review local legal/payment requirements before accepting tournament deposits or distributing prizes.
