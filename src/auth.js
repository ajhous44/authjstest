import NextAuth, { customFetch } from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"
import { ProxyAgent, fetch as undici } from "undici"

// Configure proxy from environment variable
const proxyUrl = process.env.HTTPS_PROXY ?? "http://my.proxy.server:8080"
const dispatcher = new ProxyAgent(proxyUrl)

// Debug logging helper
function debugLog(requestId, stage, data) {
  console.log(`[Auth:${requestId}] [${stage}]`, JSON.stringify(data, null, 2))
}

// Enhanced proxy function with detailed logging
function proxy(url, options = {}) {
  const requestId = Math.random().toString(36).slice(2, 8)
  const isCSRF = url.toString().includes('/csrf')
  const isSignIn = url.toString().includes('/signin') || url.toString().includes('oauth/v2.0/authorize')
  const isEntraID = url.toString().includes('login.microsoftonline.com')

  debugLog(requestId, 'START', {
    url: url.toString(),
    type: {
      isCSRF,
      isSignIn,
      isEntraID
    },
    options: {
      method: options.method,
      headers: options.headers ? Object.fromEntries(new Headers(options.headers)) : {},
      body: options.body ? '<<present>>' : '<<none>>'
    }
  })

  // Special handling for CSRF requests
  if (isCSRF) {
    debugLog(requestId, 'CSRF', 'Using direct fetch for CSRF request')
    try {
      return undici(url, options).then(response => {
        debugLog(requestId, 'CSRF_RESPONSE', {
          status: response.status,
          statusText: response.statusText
        })
        return response
      })
    } catch (error) {
      debugLog(requestId, 'CSRF_ERROR', {
        name: error.name,
        message: error.message
      })
      throw error
    }
  }

  // Prepare fetch options with proxy
  const fetchOptions = {
    ...options,
    dispatcher,
    duplex: 'half',
    keepalive: true,
    timeout: 30000,
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

  debugLog(requestId, 'REQUEST', {
    url: url.toString().replace(/[?#].*$/, ''),
    method: fetchOptions.method || 'GET',
    headers: Object.fromEntries(fetchOptions.headers.entries()),
    proxy: {
      url: proxyUrl,
      type: dispatcher.constructor.name,
      options: {
        keepalive: fetchOptions.keepalive,
        timeout: fetchOptions.timeout,
        duplex: fetchOptions.duplex
      }
    }
  })

  // Wrap the fetch call in a try-catch for more detailed error logging
  try {
    debugLog(requestId, 'FETCH_START', 'Initiating fetch request')
    return undici(url, fetchOptions)
      .then(response => {
        debugLog(requestId, 'RESPONSE', {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          type: response.type,
          url: response.url.replace(/[?#].*$/, ''),
          headers: Object.fromEntries(response.headers.entries())
        })

        // For error responses, try to get the body
        if (!response.ok) {
          response.clone().text().then(text => {
            try {
              debugLog(requestId, 'ERROR_BODY', JSON.parse(text))
            } catch {
              debugLog(requestId, 'ERROR_BODY', text)
            }
          }).catch(e => debugLog(requestId, 'ERROR_BODY_FAILED', e.message))
        }

        debugLog(requestId, 'RESPONSE_TYPE', {
          constructor: response.constructor.name,
          prototype: Object.getPrototypeOf(response).constructor.name,
          properties: Object.keys(response)
        })

        return response
      })
      .catch(error => {
        debugLog(requestId, 'FETCH_ERROR', {
          name: error.name,
          message: error.message,
          cause: error.cause,
          code: error.code,
          stack: error.stack,
          type: error.type
        })
        throw error
      })
  } catch (error) {
    debugLog(requestId, 'IMMEDIATE_ERROR', {
      name: error.name,
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

const authConfig = {
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
}

const { handlers, auth, signIn, signOut } = NextAuth(authConfig)

export { handlers, auth, signIn, signOut, authConfig } 