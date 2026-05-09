import { customAlphabet } from "nanoid";

const alphabet = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);

export function generateShareCode(): string {
  return alphabet();
}
