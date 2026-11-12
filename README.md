# Ledgerly CIS

Ledgerly CIS is a local bookkeeping app for tracking CIS income, expenses, invoices, sites, receipts, and tax estimates.

## Requirements

- Node.js 22.12 or newer
- npm

## Run in development

From the project directory, install dependencies and start the app:

```sh
npm install
npm run dev
```

Open [http://127.0.0.1:5173](http://127.0.0.1:5173). The development command starts both the Vite app and the local database server.

To stop them, press **Ctrl+C** in the terminal.

## Login

- **Username:** `TestUser` (the username check is case-insensitive)
- **Password:** `Password` (at least 8 characters)

To change the password, generate its SHA-256 hash in the terminal (the input is hidden):

```sh
read -s -p "New password: " PW; echo; printf %s "$PW" | shasum -a 256
```

Replace the `adminHash` value in `src/App.jsx` with the 64-character hash printed by that command. Keep the username as `TestUser`, or change the username check in the same file if desired. The login is a basic local-app screen, not production-grade authentication; do not expose this app or use it to protect sensitive data on a shared or public network.

## Build and run the production version

```sh
npm install
npm run build
npm start
```

Open [http://127.0.0.1:3001](http://127.0.0.1:3001). `npm start` serves the built app and its API. To use a different local server port, set `PORT` before starting it, for example:

```sh
PORT=3002 npm start
```

## Data and backups

The local database and uploaded invoice files are stored under `.data/`:

- `.data/ledgerly.sqlite` — bookkeeping records
- `.data/invoices/` — uploaded invoice files

This local database contains sample records labeled `DEMO`; the names and amounts are fictional and are for testing only.

Back up the `.data/` directory regularly. Keep it private and do not delete it unless you intend to remove the locally stored records and files.
