# Using an existing EduTrack / Find Me database — read first

If you have important records, **back up the database in pgAdmin before doing anything else**. Keep the old project folder and `.env` as a rollback option.

The smaller Find Me version is **primarily a frontend navigation refactor**, and the database schema is the same as the preceding simplified Admin+Professor project. **Do not reset the database** just to simplify pages.

1. Confirm your existing backend database URL, correct PostgreSQL database, and encryption key. If older records are encrypted, **keep the same `DATA_ENCRYPTION_KEY`**. Switching keys makes ciphertext unreadable.
2. Review `backend/prisma/schema.prisma` against your existing database before applying any schema changes. **Do not automatically run `prisma db push`, `migrate reset`, or seed against your original database.**
3. If migrating from an earlier edition where `studentNumber` was plaintext, verify compatibility, back up database, then use dry run from `backend`:

   ```powershell
   npm run db:encrypt-existing-students
   ```

   Once you have a backup, verified the key, and checked the migration counts, run only if appropriate:

   ```powershell
   npm run db:encrypt-existing-students:apply
   ```

4. Open the app and test login, student registration, RFID assignment, one class enrollment, sessions, historical attendance, and paid-plan billing. **Do not execute payments against an unverified production account.**

If this is just a frontend update from **Find_Me_Simplified_Complete.zip**, copy only the modified frontend files (see the changed-files ZIP) into the matching paths, and you don't need any database migration to apply the four-page navigation.
