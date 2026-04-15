import admin from "firebase-admin";
import fs from "fs";

// read JSON manually
const serviceAccount = JSON.parse(
  fs.readFileSync(
    new URL("../config/firebase-service-account.json", import.meta.url),
  ),
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

export default admin;
