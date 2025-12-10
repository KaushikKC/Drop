// Jest setup file
// Add any global test setup here

// Mock environment variables for tests
process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/drop_test';
process.env.ETHEREUM_RPC_URL = process.env.TEST_ETHEREUM_RPC_URL || 'https://sepolia.base.org';
process.env.ETHEREUM_NETWORK = 'sepolia';
process.env.USDC_TOKEN_ADDRESS = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
process.env.JWT_SECRET = 'test-secret-key';

