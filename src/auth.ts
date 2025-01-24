import NextAuth, { customFetch } from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { ProxyAgent, fetch as undici } from "undici"

// Configure proxy from environment variable
const proxyUrl = process.env.HTTPS_PROXY ?? "http://my.proxy.server:8080"
const dispatcher = new ProxyAgent(proxyUrl)

// Enhanced proxy function with detailed logging
function proxy(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  const [url, options = {}] = args
  const requestId = Math.random().toString(36).slice(2, 8)

  // Log request details (safely)
  console.log(`[Auth:${requestId}] Request:`, {
    url: url.toString().replace(/[?#].*$/, ''), // Remove sensitive query params
    method: options.method || 'GET',
    proxyUrl
  })

  // @ts-expect-error undici has additional options
  return undici(url, { 
    ...options, 
    dispatcher,
    duplex: 'half'  // Required for some HTTPS requests
  }).then(response => {
    // Log response details
    if (!response.ok) {
      console.error(`[Auth:${requestId}] Error:`, {
        status: response.status,
        statusText: response.statusText,
        url: response.url.replace(/[?#].*$/, '')
      })
      // Clone and log response body for debugging
      response.clone().text().then(text => {
        try {
          console.error(`[Auth:${requestId}] Error Body:`, JSON.parse(text))
        } catch {
          console.error(`[Auth:${requestId}] Error Body:`, text)
        }
      }).catch(e => console.error(`[Auth:${requestId}] Could not read error body:`, e))
    } else {
      console.log(`[Auth:${requestId}] Success:`, {
        status: response.status,
        url: response.url.replace(/[?#].*$/, '')
      })
    }
    return response
  }).catch(error => {
    console.error(`[Auth:${requestId}] Proxy Error:`, {
      name: error.name,
      message: error.message,
      cause: error.cause,
      url: url.toString().replace(/[?#].*$/, ''),
      proxyUrl
    })
    throw error
  })
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          scope: "openid profile email"
        }
      },
      // Optional: Configure tenant access
      // tenantId: "common", // Allow all Microsoft accounts
      // tenantId: "organizations", // Allow work/school accounts only
      // tenantId: "consumers", // Allow personal accounts only
      // tenantId: "your-tenant-id", // Your specific organization only
      [customFetch]: proxy
    })
  ],
  debug: true
})