# Find Me — Simple RFID Attendance System

**Two staff login roles. Four main pages.** Students are registered attendance records and **do not log in**.

- **Dashboard** — class/session counts and quick links.
- **Management** — Admin registers students (name + student number), registers/revokes RFID credentials, creates professor accounts, creates classes, and enrolls students. Professors can only see their assigned classes.
- **Attendance** — professors start/stop sessions, simulate RFID scans, view live attendance; Admin/Professor review records and download CSV if the institution has an eligible plan.
- **Billing** — Admin-only Free/Basic/Premium plans, Xendit GCash/Maya **test** checkout, verified webhook-based activation, payment history.

Open class details and live attendance from Management and Attendance; these are **detail views**, not extra sidebar pages.

**Features retained:** AES-256-GCM encryption of new student numbers; decryption for authorized roster, attendance and CSV responses; SHA-256 RFID credential digest lookup (demonstration); Argon2 password hashes; subscription-based class/account/report restrictions; Xendit test integration; server-sent attendance updates. **MQTT/ESP32 is a future integration, not yet connected.**

## Start

Read [`SETUP_WINDOWS.md`](SETUP_WINDOWS.md) for step-by-step setup. For an existing database, use [`EXISTING_DATABASE.md`](EXISTING_DATABASE.md) *before running migration or seed commands*. For Xendit developer setup, read [`XENDIT_SETUP_WINDOWS.md`](XENDIT_SETUP_WINDOWS.md).

Run `npm run dev` from the project root after dependencies, database, and environment are configured. The frontend runs on `http://localhost:5173`, and the backend listens on `http://localhost:4000` by default.

## Attendance flow

1. Admin registers the student's name and encrypted student number; no email/password is needed.
2. Admin assigns an RFID token (simulated initially) and enrolls student in a class.
3. Professor starts a class session in Attendance.
4. Professor enters that token in the session's Virtual RFID Scanner. The backend resolves the registered credential, validates enrollment/session/duplicate, records attendance, and notifies the dashboard through SSE.
5. Professor ends the session; missing enrolled students become absent. Permitted staff can export CSV if their institution's plan enables reports.

## Security details

- Student numbers are encrypted **before database storage** for new records and decrypted only by authenticated, authorized staff responses. **Older plaintext records must be migrated separately.** The student names and attendance statuses remain readable in the database.
- RFID values are hashed by the existing SHA-256 `digest()` utility. This demonstration is not resistant to copied UID cards or small-space offline guesses; for production, use stronger cards and keyed lookup, device authentication, and TLS.
- Staff passwords are hashed with Argon2; these are not reversible encryption.
- Xendit test mode only: billing requires internet, a configured developer key, and a reachable webhook for end-to-end verification. A checkout redirect alone is not proof of payment.
- **MQTT/ESP32 hardware is not implemented**. Future work: authenticated device registration, local or hosted MQTT broker (TLS), subscribe to scans, call shared attendance validation, and send scan acknowledgement to ESP32.
