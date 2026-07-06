import { sql } from "../lib/db.js";
import 'dotenv/config';

async function main() {
  const convs = await sql`SELECT id, user_id, title FROM conversations`;
  console.log("Conversations:", convs);
  process.exit(0);
}

main().catch(console.error);
