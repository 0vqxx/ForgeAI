// OAuth Authentication Integration

import { createLovableAuth } from "@lovable.dev/cloud-auth-js";
import { supabase } from "../supabase/client";
const oauthAuth = createLovableAuth();

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

export const auth = {
  signInWithOAuth: async (provider: "google" | "apple" | "microsoft" | "lovable", opts?: SignInOptions) => {
    const result = await oauthAuth.signInWithOAuth(provider, {
      redirect_uri: opts?.redirect_uri,
      extraParams: {
        ...opts?.extraParams,
      },
    });

    if (result.redirected) {
      return result;
    }

    if (result.error) {
      return result;
    }

    try {
      await supabase.auth.setSession(result.tokens);
    } catch (e) {
      return { error: e instanceof Error ? e : new Error(String(e)) };
    }
    return result;
  },
};
