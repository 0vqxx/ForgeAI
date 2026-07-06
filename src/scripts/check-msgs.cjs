const postgres = require('postgres');
const sql = postgres('postgresql://neondb_owner:ef2f79d53f8bea2b7b994c1b89e04aa677f23ac0fa0ade8b@ep-hidden-sun-atnqzq0a-pooler.c-9.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require');
sql`SELECT id, user_id FROM conversations WHERE id = 'd48cd0fd-f22c-41dd-a4e3-41f9d8220fc4'`.then(r => { console.log('d48cd0fd user:', r[0].user_id); process.exit(0) }).catch(console.error);
