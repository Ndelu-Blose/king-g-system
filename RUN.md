# Running King G

## Start the app (with real database for real-time data)

1. **Start the API server** (SQLite database and REST API on port 3001):

   ```bash
   cd server
   npm install
   npm start
   ```

   Leave this terminal open. You should see: `King G API running at http://localhost:3001 (SQLite database)`.

2. **Start the frontend** (in a second terminal, from the project root):

   ```bash
   npm run dev
   ```

   Open the URL shown (e.g. `http://localhost:8080`). The app will proxy `/api` to the server. Sales are stored in `server/data/kingg.db` and **Transaction History** / **Sales History** refresh from the database every few seconds (real-time).

If you skip step 1, the app still runs but uses mock data and in-memory fallbacks; no persistence. **Call Manager** (Help & Support) also needs the backend so managers see help requests on the **Alerts & Help** page.

## "Can't reach this page" / Connection timeout

If you get **ERR_CONNECTION_TIMED_OUT** when opening `http://10.15.12.115:8080`:

1. **Run the dev server on the same machine as that IP**
   - `10.15.12.115` must be the IP of the PC where you run `npm run dev`.
   - On that PC, open a terminal in this project and run: `npm run dev`.

2. **Allow Windows Firewall**
   - When you first run `npm run dev`, Windows may ask to allow Node.js. Click **Allow access**.
   - If you already blocked it: Windows Security → Firewall → Allow an app → find **Node.js** → enable **Private** (and **Public** if you need access from other networks).

3. **Use the URL from the terminal**
   - After `npm run dev`, the terminal shows something like:
     - `Local:   http://localhost:8080/`
     - `Network: http://10.15.12.115:8080/`
   - On the **same** PC: use `http://localhost:8080`.
   - From **another** device (phone, other PC): use `http://10.15.12.115:8080` (same Wi‑Fi/network).

4. **If port 8080 is in use**
   - The app will try the next port (e.g. 8081). Use the URL that Vite prints.

## Login

Use **owner@kingg.co.za** (any password) to sign in. Cashier: **sipho@kingg.co.za**.

---

## Cashier workflow (sales only)

**Cashier can:**
- **New sale** – POS Terminal: scan barcode or manual item search, add to cart.
- **Take payment** – Cash (enter amount received, see change) or Card/EFT.
- **Print receipt** – After payment, “Print receipt” is shown; then Done to start next sale.
- **Sales History** – My shift / Today (sidebar).
- **End shift / Cash-up** – Sidebar “End shift / Cash-up”: enter counted cash and optional notes, then End shift.
- **Open Shift** and **Help / Support** (call manager).

**Cashier cannot:**
- Create or edit products.
- Do refunds or voids (these require manager approval; no access to those screens).
- See full business reports (only their own sales history).
