import dotenv from 'dotenv';
import { getPool } from './index';
import { readFile } from 'fs/promises';
import { join } from 'path';
import pino from 'pino';

dotenv.config();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

async function runRoyaltyMigration() {
  try {
    const migrationPath = join(__dirname, 'migrations', '002_add_royalty_tokens.sql');
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      logger.info('Running migration: 002_add_royalty_tokens.sql');
      await client.query('BEGIN');
      
      // Create migrations table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) UNIQUE NOT NULL,
          run_on TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const migrationName = '002_add_royalty_tokens.sql';
      
      // Check if migration has already been run
      const { rows } = await client.query(
        'SELECT id FROM migrations WHERE name = $1',
        [migrationName]
      );

      if (rows.length > 0) {
        logger.info(`Migration ${migrationName} already applied, skipping...`);
        return;
      }
      
      // Split by semicolons and execute each statement
      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      logger.info(`Found ${statements.length} statements to execute`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            const result = await client.query(statement);
            logger.info(`✓ [${i + 1}/${statements.length}] Executed: ${statement.substring(0, 80)}...`);
            if (result.rowCount !== undefined) {
              logger.debug(`   Rows affected: ${result.rowCount}`);
            }
          } catch (error: any) {
            // Ignore "already exists" errors
            if (error.code === '42P07' || // table already exists
                error.code === '42710' || // duplicate object
                error.message.includes('already exists')) {
              logger.info(`⊘ [${i + 1}/${statements.length}] Skipped (already exists)`);
              continue;
            }
            logger.error(`✗ [${i + 1}/${statements.length}] Error: ${error.message}`);
            throw error;
          }
        }
      }
      
      // Mark migration as complete
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [migrationName]);
      
      await client.query('COMMIT');
      logger.info('✅ Royalty tokens migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    logger.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  runRoyaltyMigration().catch(err => {
    logger.error('Fatal migration error:', err);
    process.exit(1);
  });
}

export { runRoyaltyMigration };

