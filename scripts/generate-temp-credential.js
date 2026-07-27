const { pbkdf2Sync, randomBytes } = require("crypto");

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const entropy = randomBytes(18);
let password = "A7a!";
for (const byte of entropy) password += alphabet[byte % alphabet.length];
const salt = randomBytes(16);
const encoded = (value) => value.toString("base64url");
const hash = pbkdf2Sync(password, salt, 210000, 32, "sha256");
process.stdout.write(JSON.stringify({ password, hash: `pbkdf2_sha256$210000$${encoded(salt)}$${encoded(hash)}` }));
