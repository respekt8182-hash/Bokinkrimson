// Domain/service module for passwords.
import { randomInt } from "crypto";

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%";
const ALL = `${UPPER}${LOWER}${DIGITS}${SPECIAL}`;

function pick(pool: string): string {
  return pool[randomInt(0, pool.length)] ?? "";
}

function shuffle(value: string): string {
  const chars = value.split("");
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(0, index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars.join("");
}

export function generateTemporaryPassword(length = 10): string {
  const targetLength = Math.max(8, length);
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SPECIAL)];
  const remainder = Array.from({ length: targetLength - required.length }, () => pick(ALL));
  return shuffle([...required, ...remainder].join(""));
}
