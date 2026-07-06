import { sql } from "../lib/db.js";
import 'dotenv/config';

async function main() {
  const msgs = await sql`SELECT * FROM messages WHERE conversation_id = 'd48cd0fd-f22c-41dd-a4e3-41f9d0220fc4'`;
  console.log("Messages for conversation d48cd0fd-f22c-41dd-a4e3-41f9d0220fc4:", msgs);
  process.exit(0);
}

main().catch(console.error);
