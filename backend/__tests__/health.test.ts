import request from 'supertest';
import express from 'express';

// This is a simple example test
// For full testing, you'd need to import your app from src/index.ts
// But that requires the database to be set up

describe('Health Check', () => {
  it('should return 200 and status ok', async () => {
    // Note: This requires the server to be running
    // For isolated tests, you'd need to mock the database
    const response = await request('http://localhost:3001')
      .get('/health')
      .expect(200);

    expect(response.body).toHaveProperty('status', 'ok');
  });
});

