import { Pool, PoolClient } from "pg";
import pino from "pino";

const logger = pino({ level: process.env.LOG_LEVEL || "info" });

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Log connection attempt (without exposing full credentials)
    const maskedUrl = databaseUrl.replace(/:[^:@]+@/, ":****@");
    logger.info(`Connecting to database: ${maskedUrl}`);

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000, // Increased timeout for serverless
    });

    pool.on("error", (err) => {
      logger.error("Unexpected error on idle client", err);
    });
  }

  return pool;
}

export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await getPool().connect();
  try {
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  const fs = await import("fs/promises");
  const path = await import("path");

  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL environment variable is not set");
    }

    // Find schema file - handle both local and Vercel serverless environments
    let schemaPath: string | undefined;
    const possiblePaths = [
      path.join(__dirname, "schema.sql"), // Local development (compiled)
      path.join(__dirname, "db", "schema.sql"), // Vercel compiled path
      path.join(__dirname, "..", "db", "schema.sql"), // Alternative compiled path
      path.join(process.cwd(), "src", "db", "schema.sql"), // Source path
      path.join(process.cwd(), "backend", "src", "db", "schema.sql"), // Root-level path
      path.join("/var/task", "src", "db", "schema.sql"), // Vercel serverless path
      path.join("/var/task", "backend", "src", "db", "schema.sql"), // Vercel alternative
    ];

    let schema: string | undefined;
    let found = false;

    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        schemaPath = possiblePath;
        schema = await fs.readFile(possiblePath, "utf-8");
        found = true;
        logger.info(`Schema file found at: ${schemaPath}`);
        break;
      } catch {
        // Try next path
        continue;
      }
    }

    if (!found || !schema) {
      // If schema file not found, try to continue without it (tables might already exist)
      logger.warn(
        "Schema file not found. Assuming database tables already exist."
      );
      // Test connection and return early
      const testClient = await getPool().connect();
      try {
        await testClient.query("SELECT 1");
        logger.info(
          "Database connection successful (skipping schema initialization)"
        );
        return;
      } catch (connError: any) {
        const errorMessage = connError.message || String(connError);
        logger.error(
          "Database connection test failed (schema file not found)",
          {
            message: errorMessage,
            code: connError.code,
          }
        );
        throw new Error(
          `Database connection failed: ${errorMessage}\n` +
            `Please verify DATABASE_URL is set correctly in Vercel environment variables.`
        );
      } finally {
        testClient.release();
      }
    }

    // Test database connection first
    const testClient = await getPool().connect();
    try {
      await testClient.query("SELECT 1");
      logger.info("Database connection successful");
    } catch (connError: any) {
      const errorMessage = connError.message || String(connError);
      const errorCode = connError.code;

      logger.error("Database connection failed", {
        message: errorMessage,
        code: errorCode,
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        databaseUrlMasked: process.env.DATABASE_URL
          ? process.env.DATABASE_URL.replace(/:[^:@]+@/, ":****@")
          : "not set",
      });

      // Provide more specific error messages
      if (errorCode === "ECONNREFUSED") {
        throw new Error(
          `Cannot connect to database server. Please check:\n` +
            `1. Database server is running and accessible\n` +
            `2. DATABASE_URL host and port are correct\n` +
            `3. If using a cloud database, ensure Vercel IPs are whitelisted\n` +
            `4. Check firewall/network settings\n` +
            `Error: ${errorMessage}`
        );
      } else if (
        errorCode === "ETIMEDOUT" ||
        errorMessage.includes("timeout")
      ) {
        throw new Error(
          `Database connection timed out. Please check:\n` +
            `1. Database server is accessible from Vercel's network\n` +
            `2. Network connectivity and firewall rules\n` +
            `3. Database server is not overloaded\n` +
            `Error: ${errorMessage}`
        );
      } else if (
        errorMessage.includes("password") ||
        errorMessage.includes("authentication")
      ) {
        throw new Error(
          `Database authentication failed. Please check:\n` +
            `1. DATABASE_URL username and password are correct\n` +
            `2. Database user has proper permissions\n` +
            `Error: ${errorMessage}`
        );
      } else if (
        errorMessage.includes("does not exist") ||
        errorCode === "3D000"
      ) {
        throw new Error(
          `Database does not exist. Please check:\n` +
            `1. Database name in DATABASE_URL is correct\n` +
            `2. Database has been created\n` +
            `Error: ${errorMessage}`
        );
      } else {
        throw new Error(
          `Database connection failed: ${errorMessage}\n` +
            `Error code: ${errorCode || "N/A"}\n` +
            `Please verify:\n` +
            `1. DATABASE_URL is set correctly in Vercel environment variables\n` +
            `2. Database server is accessible\n` +
            `3. Database credentials are correct`
        );
      }
    } finally {
      testClient.release();
    }

    // Split by semicolons and execute each statement
    // Remove comments first, then split
    const schemaWithoutComments = schema
      .split("\n")
      .map((line) => {
        const commentIndex = line.indexOf("--");
        return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      })
      .join("\n");

    const statements = schemaWithoutComments
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Log first few statements for debugging
    logger.debug(
      `First 3 statements:`,
      statements.slice(0, 3).map((s, i) => `${i + 1}: ${s.substring(0, 50)}...`)
    );

    const client = await getPool().connect();
    try {
      logger.info(`Executing ${statements.length} SQL statements...`);
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            await client.query(statement);
            logger.debug(`✓ Executed statement ${i + 1}/${statements.length}`);
          } catch (stmtError: any) {
            // Some errors are expected (e.g., table already exists, extension already exists)
            if (
              stmtError.message.includes("already exists") ||
              stmtError.message.includes("duplicate key") ||
              stmtError.message.includes("duplicate") ||
              stmtError.code === "42P07" || // duplicate_table
              stmtError.code === "42710"
            ) {
              // duplicate_object
              logger.debug(
                `⊘ Statement ${i + 1} skipped (already exists): ${
                  stmtError.message
                }`
              );
              continue;
            }

            // Extension permission errors - try to continue without it
            if (
              stmtError.message.includes("permission denied") &&
              statement.includes("CREATE EXTENSION")
            ) {
              logger.warn(
                `⚠ Extension creation skipped (permission denied). Using uuid-ossp or gen_random_uuid() may not work.`
              );
              logger.warn(
                `  You may need to run: CREATE EXTENSION IF NOT EXISTS "pgcrypto"; as superuser`
              );
              continue;
            }

            // Log the full error for debugging - use console.error for better visibility
            console.error("\n❌ SQL ERROR DETAILS:");
            console.error(`Statement ${i + 1}/${statements.length}:`);
            console.error(`Error: ${stmtError.message}`);
            console.error(`Code: ${stmtError.code || "N/A"}`);
            console.error(`Detail: ${stmtError.detail || "N/A"}`);
            console.error(`Hint: ${stmtError.hint || "N/A"}`);
            console.error(`\nSQL Statement:\n${statement}\n`);

            logger.error(
              `✗ Failed to execute statement ${i + 1}/${statements.length}:`,
              {
                error: stmtError.message,
                code: stmtError.code,
                detail: stmtError.detail,
                hint: stmtError.hint,
                position: stmtError.position,
                statement: statement.substring(0, 300),
                fullError: JSON.stringify(
                  stmtError,
                  Object.getOwnPropertyNames(stmtError)
                ),
              }
            );

            // Show the actual error in the thrown message
            const errorDetails = [
              `Statement ${i + 1}/${statements.length} failed:`,
              `Error: ${stmtError.message}`,
              stmtError.code ? `Code: ${stmtError.code}` : "",
              stmtError.detail ? `Detail: ${stmtError.detail}` : "",
              stmtError.hint ? `Hint: ${stmtError.hint}` : "",
              `\nSQL Statement:\n${statement}`,
            ]
              .filter(Boolean)
              .join("\n");

            throw new Error(errorDetails);
          }
        }
      }
      logger.info("Database schema initialized successfully");
    } finally {
      client.release();
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;

    logger.error("Failed to initialize database schema:", {
      message: errorMessage,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      stack: errorStack,
    });

    // Provide helpful error messages
    if (errorMessage.includes("DATABASE_URL")) {
      throw new Error(
        "DATABASE_URL environment variable is not set. Please add it to your .env file."
      );
    }
    if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("connection")
    ) {
      throw new Error(
        "Cannot connect to database. Please check:\n1. PostgreSQL is running\n2. DATABASE_URL is correct\n3. Database exists"
      );
    }
    if (
      errorMessage.includes("ENOENT") ||
      errorMessage.includes("schema.sql")
    ) {
      throw new Error(
        "Schema file not found. Make sure schema.sql exists in src/db/ directory."
      );
    }
    if (
      errorMessage.includes("permission denied") ||
      errorMessage.includes("authentication")
    ) {
      throw new Error(
        "Database authentication failed. Please check your DATABASE_URL credentials."
      );
    }

    throw new Error(`Database initialization failed: ${errorMessage}`);
  }
}
