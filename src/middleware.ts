import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// Helper to generate a unique ID for each request
const generateRequestId = () => Math.random().toString(36).slice(2, 8)

// Helper to safely stringify objects (avoiding circular references)
function safeStringify(obj: unknown, space = 2) {
  const seen = new WeakSet()
  return JSON.stringify(obj, (key, value) => {
    if (key === 'cookies' || key === '_cookies') return '<cookies>'
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
    }
    return value
  }, space)
}

// Log helper
function logRequest(requestId: string, type: string, data: Record<string, unknown>) {
  console.log(`[Middleware:${requestId}] [${type}]`, safeStringify(data))
}

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Public paths that don't require authentication
  const isPublicPath = request.nextUrl.pathname === "/";

  // If the user is not logged in and trying to access a protected route,
  // redirect them to the homepage
  if (!token && !isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Only log auth-related requests
  if (!request.url.includes('/api/auth') && !request.url.includes('/auth')) {
    return NextResponse.next()
  }

  const requestId = generateRequestId()
  const startTime = Date.now()

  // Log request details
  logRequest(requestId, 'REQUEST', {
    url: request.url,
    method: request.method,
    nextUrl: {
      pathname: request.nextUrl.pathname,
      search: request.nextUrl.search,
      host: request.nextUrl.host
    },
    headers: Object.fromEntries(
      Array.from(request.headers.entries())
        .filter(([key]) => !key.toLowerCase().includes('authorization'))
    )
  })

  // Process the request
  const response = NextResponse.next()

  // Log response details
  logRequest(requestId, 'RESPONSE', {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(
      Array.from(response.headers.entries())
        .filter(([key]) => !key.toLowerCase().includes('authorization'))
    ),
    duration: `${Date.now() - startTime}ms`
  })

  return response
}

// Configure which paths the middleware runs on
export const config = {
  matcher: [
    // Apply to all auth routes
    '/api/auth/:path*',
    '/auth/:path*'
  ]
} 