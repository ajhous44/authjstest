import NextAuth, { customFetch } from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { ProxyAgent, fetch as undici, type Response as UndiciResponse } from "undici"

// Configure proxy from environment variable
const proxyUrl = process.env.HTTPS_PROXY ?? "http://my.proxy.server:8080"
const dispatcher = new ProxyAgent(proxyUrl)

// Enhanced proxy function with detailed logging
function proxy(...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
  const [url, options = {}] = args
  const requestId = Math.random().toString(36).slice(2, 8)
  const isCSRF = url.toString().includes('/csrf')
  const isSignIn = url.toString().includes('/signin') || url.toString().includes('oauth/v2.0/authorize')
  const isEntraID = url.toString().includes('login.microsoftonline.com')

  // Log request details (safely)
  console.log(`[Auth:${requestId}] Request:`, {
    url: url.toString().replace(/[?#].*$/, ''), // Remove sensitive query params
    method: options.method || 'GET',
    proxyUrl,
    isCSRF,
    isSignIn,
    isEntraID,
    // Log headers except authorization
    headers: options.headers && Object.fromEntries(
      Object.entries(new Headers(options.headers))
        .filter(([key]) => !key.toLowerCase().includes('authorization'))
        .map(([key, value]) => [key, value])
    )
  })

  // Special handling for CSRF requests
  if (isCSRF) {
    console.log(`[Auth:${requestId}] CSRF request detected, bypassing proxy`)
    // @ts-expect-error undici Response is compatible with fetch Response
    return undici(url, options)
  }

  // Prepare fetch options with proxy
  const fetchOptions = {
    ...options,
    dispatcher,
    duplex: 'half',  // Required for some HTTPS requests
    keepalive: true,
    timeout: 30000,   // 30 second timeout
    // Additional headers for proxy
    headers: new Headers({
      ...options.headers,
      'Connection': 'keep-alive',
      'Proxy-Connection': 'keep-alive'
    })
  }

  // For Entra ID requests, ensure we have the right headers
  if (isEntraID) {
    fetchOptions.headers.set('Accept', 'application/json')
    if (isSignIn) {
      fetchOptions.headers.set('Cache-Control', 'no-cache')
      fetchOptions.headers.set('Pragma', 'no-cache')
    }
  }

  // Log complete request configuration
  console.log(`[Auth:${requestId}] Request Config:`, {
    url: url.toString().replace(/[?#].*$/, ''),
    method: fetchOptions.method || 'GET',
    proxy: {
      url: proxyUrl,
      agent: 'undici/ProxyAgent',
      timeout: fetchOptions.timeout
    }
  })

  // Make the request and handle the response
  // @ts-expect-error undici Response is compatible with fetch Response
  return undici(url, fetchOptions)
    .then((response: UndiciResponse) => {
      // Log response details
      if (!response.ok) {
        console.error(`[Auth:${requestId}] Error:`, {
          status: response.status,
          statusText: response.statusText,
          url: response.url.replace(/[?#].*$/, ''),
          headers: Object.fromEntries(response.headers.entries())
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
          url: response.url.replace(/[?#].*$/, ''),
          headers: Object.fromEntries(
            Array.from(response.headers.entries())
              .filter(([key]) => !key.toLowerCase().includes('authorization'))
          )
        })
      }
      return response
    })
    .catch(error => {
      // Enhanced error logging with proxy details
      const errorDetails = {
        name: error.name,
        message: error.message,
        cause: error.cause,
        stack: error.stack?.split('\n'),
        url: url.toString().replace(/[?#].*$/, ''),
        proxyUrl,
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        hostname: error.hostname,
        type: error.type,
        phase: error.phase,
        // Additional proxy-specific details
        proxyConfig: {
          keepalive: fetchOptions.keepalive,
          timeout: fetchOptions.timeout,
          headers: Object.fromEntries(
            Array.from(new Headers(fetchOptions.headers).entries())
              .filter(([key]) => !key.toLowerCase().includes('authorization'))
          )
        }
      }
      console.error(`[Auth:${requestId}] Proxy Error:`, errorDetails)
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