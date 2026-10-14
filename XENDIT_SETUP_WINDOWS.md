# Find Me + Xendit setup for Windows (PowerShell)

## 0. Protect your current project

- **Do not overwrite** your existing working Find Me directory.
- Extract this ZIP to a new directory, such as `Downloads\Find Me_Xendit_Modular`.
- For a clean trial, make a new PostgreSQL database **`edutrack_xendit`** using pgAdmin.
- Never run `prisma migrate reset` against your old database.

## 1. Install dependencies

Open the extracted **find-me** folder in VS Code and run:

```powershell
npm install
npm run install:all
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

If `.env` already exists, don't overwrite it. Configure only what's missing.

## 2. Configure PostgreSQL and encryption

Edit **`backend/.env`**:

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/edutrack_xendit?schema=public"
PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
DATA_ENCRYPTION_KEY=YOUR_64_CHARACTER_HEX_KEY
```

Replace `YOUR_PASSWORD`, URL-encoding special characters if needed. Generate a new
AES key only for a **new empty database**:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Preserve your existing AES key if you reuse existing encrypted records.

## 3. Configure Xendit development credentials

Go to https://dashboard.xendit.co/ and open the API keys area in **test/development** mode.
Create a **development secret key** with permission to create payment sessions.

In `backend/.env`:

```env
XENDIT_SECRET_KEY=xnd_development_YOUR_SECRET_KEY
XENDIT_WEBHOOK_TOKEN=YOUR_CALLBACK_VERIFICATION_TOKEN
# Optional additional check from your Xendit account
XENDIT_BUSINESS_ID=
# Optional: set only if frontend has a PUBLIC HTTPS address
FRONTEND_PUBLIC_URL=
```

The callback verification token is from Xendit Dashboard > Webhook settings.
It is **not the same** as your API key. Never paste either in chat or frontend code.
Live keys are intentionally blocked in this project.

## 4. Setup Xendit's webhook callback

Start Find Me in one terminal:

```powershell
npm run db:generate --prefix backend
npm run db:migrate
npm run db:seed
npm run dev
```

Run a second terminal with ngrok installed:

```powershell
ngrok http 4000
```

Copy the public **HTTPS** address ngrok gives you (example only: `https://EXAMPLE.ngrok-free.app`).
In Xendit Dashboard > Webhook settings for **Payment Session** events, set URL to:

```
https://EXAMPLE.ngrok-free.app/api/payments/webhook
```

Enable the event for `payment_session.completed` and preferably `payment_session.expired`.
`XENDIT_WEBHOOK_TOKEN` must exactly match your dashboard callback token.

You do **not** need a public frontend URL for the test. Xendit requires HTTPS
for return URLs, so Find Me **omits** those fields while using localhost.
After testing checkout, return manually to `http://localhost:5173/billing`
and use **Refresh status** to see updated payment/subscription results.

## 5. Test without live charges

- Log in to `http://localhost:5173` as `admin@demo.edu`, password `DemoPass123!`.
- Click **Billing**; choose a paid plan and either GCash or Maya.
- Xendit must have your selected wallet enabled, otherwise it rejects checkout.
- Complete Xendit's **sandbox/test** flow using their test instructions.
- A pending payment should change to `PAID` **only after** a verified webhook.
- Check the payment history and subscription expiration date.

Other demo users: `professor@demo.edu` / `student@demo.edu`, same development password.
Professor demo scan token: `DEMO-RFID-001`.

## 6. Source-level tests

```powershell
npm test --prefix backend
npm run build --prefix frontend
```

### Common errors

- **P1000:** wrong PostgreSQL password. Check backend `.env`.
- **P1001:** PostgreSQL is stopped or wrong host/port.
- **Drift detected:** ensure you use the NEW `edutrack_xendit` DB, not `edutrack`.
- **Xendit isn't configured:** missing development secret key.
- **Invalid channel:** activate GCash/Maya for your Xendit account.
- **Payment remains pending:** check ngrok is running, callback URL/token, and Xendit webhook delivery logs. Do not fake success.
- **No redirect back:** expected for localhost; return manually to Billing.

## Architecture notes

Backend entrypoint remains `backend/src/server.js`.
Existing attendance, class management, role middleware, and Prisma schema were
left unchanged. Only Billing UI, payment route/service/gateway, docs/config and
payment unit tests were replaced.
