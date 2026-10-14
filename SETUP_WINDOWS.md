# Find Me — Windows setup (new database)

**Keep your old project and database unchanged while testing this version.** These steps are for a **new empty local PostgreSQL database**.

1. Extract the ZIP, open the extracted `find-me-simple` folder in VS Code, and stop any older server already using port 4000 or 5173.
2. Install Node.js LTS and PostgreSQL/pgAdmin if needed. In a VS Code terminal at the project root:

   ```powershell
   npm install
   npm run install:all
   ```

3. In pgAdmin, create a PostgreSQL database called `find_me_demo` (you can choose a different name).
4. Copy environment templates from the project root:

   ```powershell
   Copy-Item backend/.env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

5. Edit `backend/.env` with your PostgreSQL connection URL. Use the name `find_me_demo` in that URL. If your DB password has reserved URI characters, URL-encode them. Generate an AES key:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Put that **64-character hexadecimal value** in `DATA_ENCRYPTION_KEY` and do not share it. Keep `FRONTEND_ORIGIN=http://localhost:5173` and `PORT=4000`. In `frontend/.env`, use `VITE_API_URL=http://localhost:4000`. Xendit values can remain blank until payment testing.
6. From the project root, initialize **only this new, empty database**:

   ```powershell
   cd backend
   npx prisma generate
   npx prisma db push
   npm run db:seed
   cd ..
   ```

7. Start both servers from the project root:

   ```powershell
   npm run dev
   ```

8. Open `http://localhost:5173` and log in with the *development-only* seeded staff accounts:

   - Admin: `admin@demo.edu`
   - Professor: `professor@demo.edu`
   - Demo password for both: `DemoPass123!`

9. Admin → Management → Students & professors: register a test student and RFID token. Admin → Management → Classes: enroll them. Professor → Attendance → Sessions: start a session and scan that same RFID token. Check attendance updates and student number display.

**Do not use the demo password or developer credentials in a real deployment.** The app is a class project prototype.

**CSV export:** The Free plan allows attendance viewing but restricts CSV. Use an active Basic/Premium plan to download CSV. Xendit checkout requires correct development credentials and verified webhook delivery.
