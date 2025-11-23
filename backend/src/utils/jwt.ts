import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JWTPayload {
  assetId: string;
  unlockLayerId?: string;
  exp?: number;
}

export function signJwt(payload: JWTPayload, expiresIn: string = '5m'): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn });
}

export function verifyJwt(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, config.jwt.secret) as JWTPayload;
  } catch (error) {
    return null;
  }
}

