import dotenv from 'dotenv';
import { initDatabase } from "./index";

// Load environment variables from .env file
dotenv.config();

async function main() {
  try {
    console.log("Initializing database schema...");
    await initDatabase();
    console.log("Database migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
