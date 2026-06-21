import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import { phoneNumberClient } from "better-auth/client/plugins";
import * as SecureStore from "expo-secure-store";
import { BASE_URL } from "@/src/lib/api-config";

export const authClient = createAuthClient({
  baseURL: BASE_URL,
  plugins: [
    expoClient({
      scheme: "uitfood",
      storagePrefix: "uitfood",
      storage: SecureStore,
    }),
    phoneNumberClient(),
  ],
});

export const { signIn, signUp, signOut, useSession } = authClient;
