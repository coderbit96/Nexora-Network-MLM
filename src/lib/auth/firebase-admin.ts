import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { getFirebaseAdminEnv } from "@/lib/env";

export function getFirebaseAdminAuth() {
  const app = getApps().length
    ? getApps()[0]
    : (() => {
        const env = getFirebaseAdminEnv();
        return initializeApp({
          credential: cert({
            projectId: env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }),
        });
      })();

  return getAuth(app);
}
