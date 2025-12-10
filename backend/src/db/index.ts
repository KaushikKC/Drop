import { Pool, PoolClient } from 'pg';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
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
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function initDatabase(): Promise<void> {
  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    // Check if DATABASE_URL is set
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    // Check if schema file exists
    const schemaPath = path.join(__dirname, 'schema.sql');
    try {
      await fs.access(schemaPath);
    } catch {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schema = await fs.readFile(schemaPath, 'utf-8');
    
    // Test database connection first
    const testClient = await getPool().connect();
    try {
      await testClient.query('SELECT 1');
      logger.info('Database connection successful');
    } catch (connError: any) {
      throw new Error(`Database connection failed: ${connError.message}`);
    } finally {
      testClient.release();
    }
    
    // Split by semicolons and execute each statement
    // Remove comments first, then split
    const schemaWithoutComments = schema
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
      })
      .join('\n');
    
    const statements = schemaWithoutComments
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Log first few statements for debugging
    logger.debug(`First 3 statements:`, statements.slice(0, 3).map((s, i) => `${i + 1}: ${s.substring(0, 50)}...`));

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
            if (stmtError.message.includes('already exists') || 
                stmtError.message.includes('duplicate key') ||
                stmtError.message.includes('duplicate') ||
                stmtError.code === '42P07' || // duplicate_table
                stmtError.code === '42710') { // duplicate_object
              logger.debug(`⊘ Statement ${i + 1} skipped (already exists): ${stmtError.message}`);
              continue;
            }
            
            // Extension permission errors - try to continue without it
            if (stmtError.message.includes('permission denied') && 
                statement.includes('CREATE EXTENSION')) {
              logger.warn(`⚠ Extension creation skipped (permission denied). Using uuid-ossp or gen_random_uuid() may not work.`);
              logger.warn(`  You may need to run: CREATE EXTENSION IF NOT EXISTS "pgcrypto"; as superuser`);
              continue;
            }
            
            // Log the full error for debugging - use console.error for better visibility
            console.error('\n❌ SQL ERROR DETAILS:');
            console.error(`Statement ${i + 1}/${statements.length}:`);
            console.error(`Error: ${stmtError.message}`);
            console.error(`Code: ${stmtError.code || 'N/A'}`);
            console.error(`Detail: ${stmtError.detail || 'N/A'}`);
            console.error(`Hint: ${stmtError.hint || 'N/A'}`);
            console.error(`\nSQL Statement:\n${statement}\n`);
            
            logger.error(`✗ Failed to execute statement ${i + 1}/${statements.length}:`, {
              error: stmtError.message,
              code: stmtError.code,
              detail: stmtError.detail,
              hint: stmtError.hint,
              position: stmtError.position,
              statement: statement.substring(0, 300),
              fullError: JSON.stringify(stmtError, Object.getOwnPropertyNames(stmtError)),
            });
            
            // Show the actual error in the thrown message
            const errorDetails = [
              `Statement ${i + 1}/${statements.length} failed:`,
              `Error: ${stmtError.message}`,
              stmtError.code ? `Code: ${stmtError.code}` : '',
              stmtError.detail ? `Detail: ${stmtError.detail}` : '',
              stmtError.hint ? `Hint: ${stmtError.hint}` : '',
              `\nSQL Statement:\n${statement}`,
            ].filter(Boolean).join('\n');
            
            throw new Error(errorDetails);
          }
        }
      }
      logger.info('Database schema initialized successfully');
    } finally {
      client.release();
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error);
    const errorStack = error?.stack;
    
    logger.error('Failed to initialize database schema:', {
      message: errorMessage,
      code: error?.code,
      detail: error?.detail,
      hint: error?.hint,
      stack: errorStack,
    });
    
    // Provide helpful error messages
    if (errorMessage.includes('DATABASE_URL')) {
      throw new Error('DATABASE_URL environment variable is not set. Please add it to your .env file.');
    }
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('connection')) {
      throw new Error('Cannot connect to database. Please check:\n1. PostgreSQL is running\n2. DATABASE_URL is correct\n3. Database exists');
    }
    if (errorMessage.includes('ENOENT') || errorMessage.includes('schema.sql')) {
      throw new Error('Schema file not found. Make sure schema.sql exists in src/db/ directory.');
    }
    if (errorMessage.includes('permission denied') || errorMessage.includes('authentication')) {
      throw new Error('Database authentication failed. Please check your DATABASE_URL credentials.');
    }
    
    throw new Error(`Database initialization failed: ${errorMessage}`);
  }
}

