import dotenv from 'dotenv';
import { getPool } from './index';
import { readFile } from 'fs/promises';
import { join } from 'path';

dotenv.config();

async function runMigration() {
  try {
    const migrationPath = join(__dirname, 'migrations', '001_add_platform_fee_columns.sql');
    const migrationSQL = await readFile(migrationPath, 'utf-8');
    
    const pool = getPool();
    const client = await pool.connect();
    
    try {
      console.log('Running migration: 001_add_platform_fee_columns.sql');
      await client.query('BEGIN');
      
      // Split by semicolons and execute each statement
      // Remove comments first
      const lines = migrationSQL.split('\n');
      const cleanedLines = lines
        .map(line => {
          const commentIndex = line.indexOf('--');
          return commentIndex >= 0 ? line.substring(0, commentIndex) : line;
        })
        .join('\n');
      
      const statements = cleanedLines
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      console.log(`Found ${statements.length} statements to execute`);
      
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.trim()) {
          try {
            const result = await client.query(statement);
            console.log(`✓ [${i + 1}/${statements.length}] Executed:`, statement.substring(0, 100).replace(/\s+/g, ' '));
            if (result.rowCount !== undefined) {
              console.log(`   Rows affected: ${result.rowCount}`);
            }
          } catch (error: any) {
            // Ignore "column already exists" errors (code 42703) and "duplicate" errors
            if (error.code === '42703' || 
                error.code === '42P16' || // column already exists
                error.code === '42710' || // duplicate object
                error.message.includes('already exists') ||
                error.message.includes('duplicate')) {
              console.log(`⊘ [${i + 1}/${statements.length}] Skipped (already exists):`, statement.substring(0, 100).replace(/\s+/g, ' '));
              continue;
            }
            console.error(`❌ [${i + 1}/${statements.length}] Error:`, error.message);
            console.error(`   Code: ${error.code}`);
            console.error(`   Statement: ${statement.substring(0, 200)}`);
            throw error;
          }
        }
      }
      
      await client.query('COMMIT');
      console.log('✅ Migration completed successfully!');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();

