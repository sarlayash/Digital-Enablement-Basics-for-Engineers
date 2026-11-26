import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const projectId = "digital-enablement";
const email = process.argv[2];
const revoke = process.argv.includes("--revoke");

if (!email || email.startsWith("--")) {
  console.error("Usage: node grant-admin.mjs <google-email> [--revoke]");
  process.exit(2);
}

initializeApp({ projectId, credential: applicationDefault() });
const auth = getAuth();
const user = await auth.getUserByEmail(email);
const claims = { ...(user.customClaims || {}) };

if (revoke) delete claims.admin;
else claims.admin = true;

await auth.setCustomUserClaims(user.uid, claims);
console.log(`${revoke ? "Removed" : "Granted"} admin access for ${email}.`);
console.log("The user must sign out and sign in again for the new claim to take effect.");
