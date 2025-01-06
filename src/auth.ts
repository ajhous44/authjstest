import NextAuth from "next-auth";
import { type NextAuthConfig } from "next-auth";
import { ProxyAgent, fetch as undici } from "undici";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { MicrosoftEntraIDProfile } from "next-auth/providers/microsoft-entra-id";

const proxyUrl =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy;

// init proxyFetch function that will be used to route requests through proxy
async function proxyFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  console.log(
    "Proxy called for URL:",
    args[0] instanceof Request ? args[0].url : args[0]
  );
  const dispatcher = new ProxyAgent(proxyUrl!);

  if (args[0] instanceof Request) {
    const request = args[0];
    // @ts-expect-error Undici types are different but compatible
    const response = await undici(request.url, {
      ...args[1],
      method: request.method,
      headers: request.headers as HeadersInit,
      dispatcher,
    });
    return response as unknown as Response;
  }

  // @ts-expect-error Undici types are different but compatible
  const response = await undici(args[0], { ...(args[1] || {}), dispatcher });
  return response as unknown as Response;
}

/**
 * Creates a Microsoft Entra ID provider configuration and overrides the customFetch.
 */
const createAzureADProvider = () => {
  if (!proxyUrl) {
    console.log("Proxy is not enabled");
  } else {
    console.log("Proxy is enabled:", proxyUrl);
  }

  // Step 1: Create the base provider
  const baseConfig = {
    clientId: process.env.AZURE_AD_CLIENT_ID!,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
    issuer: process.env.AZURE_AD_TENANT_ID 
      ? `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/v2.0`
      : undefined,
    authorization: {
      params: {
        scope: "openid profile email User.Read",
      },
    },
    client: {
      token_endpoint_auth_method: "client_secret_post",
    },
  };

  const provider = MicrosoftEntraID(baseConfig);
  
  // if not proxyUrl, return the provider
  if (!proxyUrl) return provider;

  // Step 2: Override the customFetch in the provider
  const customFetch = Symbol.for("auth.js.custom-fetch");
  // @ts-expect-error Provider type doesn't expose symbol indexer
  provider[customFetch] = async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] instanceof Request ? args[0].url : args[0]);
    console.log("Custom Fetch Intercepted:", url.toString());

    // Handle `.well-known/openid-configuration` logic
    if (url.pathname.endsWith(".well-known/openid-configuration")) {
      console.log("Intercepting .well-known/openid-configuration");
      const response = await proxyFetch(...args);
      const json = await response.clone().json();
      const tenantRe = /microsoftonline\.com\/(\w+)\/v2\.0/;
      const tenantId = baseConfig.issuer?.match(tenantRe)?.[1] ?? "common";
      const issuer = json.issuer.replace("{tenantid}", tenantId);
      console.log("Modified issuer:", issuer);
      return Response.json({ ...json, issuer });
    }

    // Fallback for all other requests
    return proxyFetch(...args);
  };

  // Step 3: override profile since it uses fetch without customFetch
  provider.profile = async (profile: MicrosoftEntraIDProfile, tokens: { access_token?: string }) => {
    const profilePhotoSize = 48;
    console.log("Fetching profile photo via proxy");

    let image: string | null = null;
    if (tokens.access_token) {
      try {
        const response = await proxyFetch(
          `https://graph.microsoft.com/v1.0/me/photos/${profilePhotoSize}x${profilePhotoSize}/$value`,
          { headers: { Authorization: `Bearer ${tokens.access_token}` } }
        );

        if (response.ok && typeof Buffer !== "undefined") {
          const pictureBuffer = await response.arrayBuffer();
          const pictureBase64 = Buffer.from(pictureBuffer).toString("base64");
          image = `data:image/jpeg;base64,${pictureBase64}`;
        }
      } catch (error) {
        console.error("Error processing profile photo:", error);
      }
    }

    return {
      id: profile.sub,
      name: profile.name ?? profile.preferred_username ?? "Unknown",
      email: profile.email ?? profile.preferred_username ?? profile.sub,
      image: image ?? null,
    };
  };

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