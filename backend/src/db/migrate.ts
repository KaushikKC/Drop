import { initDatabase } from "./index";

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
