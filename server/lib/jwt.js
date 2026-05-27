import jwt from "jsonwebtoken";

const DEFAULT_EXPIRY = "7d";

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in environment variables.");
  }
  return secret;
}

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRY,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}
