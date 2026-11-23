// Usage: npm run hash-password
// Prompts for a password and prints a value for ADMIN_PASSWORD_HASH.
// Nothing is stored or sent anywhere.
import { scryptSync, randomBytes } from "node:crypto";
import readline from "node:readline";

const N = 16384;
const r = 8;
const p = 1;
const keylen = 64;

function hash(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, keylen, { N, r, p, maxmem: 64 * 1024 * 1024 });
  return ["scrypt", N, r, p, salt.toString("base64url"), key.toString("base64url")].join(":");
}

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

const password = process.argv[2] ?? (await ask("New admin password (min 12 characters): "));
if (!password || password.length < 12) {
  console.error("Password must be at least 12 characters.");
  process.exit(1);
}
console.log("\nADMIN_PASSWORD_HASH=" + hash(password));
console.log("\nCopy the line above into .env.local and into your host's environment variables.");
console.log("Tip: clear your terminal afterwards so the password is not left on screen.");
