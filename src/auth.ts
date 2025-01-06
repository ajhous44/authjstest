import NextAuth from "next-auth";
import { type NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { MicrosoftEntraIDProfile } from "next-auth/providers/microsoft-entra-id";

const proxyUrl =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy;

const createAzureADProvider = () => {
  if (!proxyUrl) {
    console.log("Proxy is not enabled");
  } else {
    console.log("Proxy is enabled:", proxyUrl);
  }

  const baseConfig = {
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
    authorization: {
      params: {
        scope: `api://${process.env.AUTH_MICROSOFT_ENTRA_ID_ID!}/default openid profile email`,
      },
    },
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
    httpOptions: proxyUrl ? {
      proxy: proxyUrl
    } : undefined
  };

  const provider = MicrosoftEntraID({
    ...baseConfig,
    profile(profile: MicrosoftEntraIDProfile) {
      return {
        id: profile.sub,
        name: profile.name ?? profile.preferred_username ?? "Unknown",
        email: profile.email ?? profile.preferred_username ?? profile.sub,
        image: null, // We'll handle profile photo separately if needed
        accessToken: "",
      };
    },
  });

  return provider;
};

export const config = {
  providers: [createAzureADProvider()],
  callbacks: {
    authorized({ request, auth }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/") return !!auth;
      return true;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(config); 