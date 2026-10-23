import bcrypt from "bcryptjs";
import { BCRYPT_ROUNDS } from "./constants.js";

const DUMMY_HASH = bcrypt.hashSync("dummy-password", BCRYPT_ROUNDS);

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Used when the email doesn't exist, so login takes the same time either way.
export async function fakeCompare(password) {
  await bcrypt.compare(password, DUMMY_HASH);
}