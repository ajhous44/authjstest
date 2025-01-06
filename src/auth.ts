import NextAuth from "next-auth";
import { type NextAuthConfig } from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { MicrosoftEntraIDProfile } from "next-auth/providers/microsoft-entra-id";

// Debug function to safely stringify objects/errors
function safeStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, (key, value) => {
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      return value;
    }, 2);
  } catch (err) {
    return `[Unable to stringify: ${err}]`;
  }
}

const proxyUrl =
  process.env.HTTP_PROXY ||
  process.env.HTTPS_PROXY ||
  process.env.http_proxy ||
  process.env.https_proxy;

async function proxyFetch(
  ...args: Parameters<typeof fetch>
): Promise<Response> {
  const url = args[0] instanceof Request ? args[0].url : args[0];
  console.log(`🔄 Proxy Request Starting:
  URL: ${url}
  Args: ${safeStringify(args)}
  Proxy URL: ${proxyUrl}`);

  try {
    const [urlArg, config] = args;
    console.log(`📝 Request Config: ${safeStringify(config)}`);

    const fetchConfig = {
      ...config,
      headers: {
        ...(config?.headers ?? {}),
        'x-use-proxy': 'true',
      },
    };

    console.log(`📝 Final Fetch Config: ${safeStringify(fetchConfig)}`);

    const response = await fetch(urlArg, fetchConfig).catch(error => {
      console.error(`💥 Fetch Failed:
        Error Name: ${error.name}
        Message: ${error.message}
        Stack: ${error.stack}
      `);
      throw error;
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => 'Unable to get response text');
      console.error(`❌ Proxy fetch failed for ${url}:`, {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseText
      });
    }
    return response;
  } catch (error) {
    console.error(`❌ Proxy error for ${url}:
      Type: ${error instanceof Error ? error.constructor.name : typeof error}
      Message: ${error instanceof Error ? error.message : 'Unknown error'}
      Stack: ${error instanceof Error ? error.stack : 'No stack trace'}
    `);
    throw error;
  }
}

const createAzureADProvider = () => {
  console.log(`📡 Proxy Status: ${proxyUrl ? 'Enabled' : 'Disabled'}`);
  if (proxyUrl) {
    console.log(`📡 Using proxy: ${proxyUrl}`);
  }

  const baseConfig = {
    clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
    clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
    issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
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
  
  if (!proxyUrl) return provider;

  const customFetch = Symbol.for("auth.js.custom-fetch");
  // @ts-expect-error Provider type doesn't expose symbol indexer
  provider[customFetch] = async (...args: Parameters<typeof fetch>) => {
    const url = new URL(args[0] instanceof Request ? args[0].url : args[0]);
    console.log(`🔑 Auth Request: ${url.toString()}`);

    try {
      if (url.pathname.endsWith(".well-known/openid-configuration")) {
        console.log(`🔍 Fetching OpenID config`);
        const response = await proxyFetch(...args);
        const json = await response.clone().json();
        const tenantRe = /microsoftonline\.com\/(\w+)\/v2\.0/;
        const tenantId = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.match(tenantRe)?.[1] ?? "common";
        const issuer = json.issuer.replace("{tenantid}", tenantId);
        return Response.json({ ...json, issuer });
      }

      return proxyFetch(...args);
    } catch (error) {
      console.error(`❌ Auth request failed for ${url}:`, error instanceof Error ? error.message : error);
      throw error;
    }
  };

  provider.profile = async (profile: MicrosoftEntraIDProfile, tokens: { access_token?: string }) => {
    console.log(`👤 Fetching user profile`);

    let image: string | null = null;
    if (tokens.access_token) {
      try {
        const photoUrl = `https://graph.microsoft.com/v1.0/me/photos/48x48/$value`;
        console.log(`🖼️ Fetching profile photo: ${photoUrl}`);
        
        const response = await proxyFetch(photoUrl, {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        });

        if (response.ok && typeof Buffer !== "undefined") {
          const pictureBuffer = await response.arrayBuffer();
          const pictureBase64 = Buffer.from(pictureBuffer).toString("base64");
          image = `data:image/jpeg;base64,${pictureBase64}`;
        }
      } catch (error) {
        console.error(`❌ Profile photo fetch failed:`, error instanceof Error ? error.message : error);
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