import "dotenv/config";
import { app } from "./app.js";
import { db } from "./config/database.js";

const port = Number(process.env.PORT || 4000);
const server = app.listen(port, () =>
  console.log(`Find Me API listening on http://localhost:${port}`),
);

process.on("SIGINT", async () => {
  server.close();
  await db.$disconnect();
  process.exit(0);
});
