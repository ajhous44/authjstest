import { auth } from "./auth";
import { type NextRequest } from "next/server";

export default auth((req) => {
  const { auth: session } = req;
  const { nextUrl } = req as NextRequest;

  // Public paths that don't require authentication
  const isPublicPath = nextUrl.pathname === "/";

  // If the user is not logged in and trying to access a protected route,
  // redirect them to the homepage
  if (!session && !isPublicPath) {
    return Response.redirect(new URL("/", nextUrl));
  }
});

// Optionally configure middleware to run only on specific paths
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}; 