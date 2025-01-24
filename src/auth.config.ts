import type { NextAuthConfig } from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

// See: https://authjs.dev/getting-started/providers/microsoft-entra-id
export default {
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      authorization: {
        params: {
          // Default scope for Microsoft Entra ID
          scope: "openid profile email"
        }
      },
      // Optional: Configure tenant access
      // tenantId: "common", // Allow all Microsoft accounts
      // tenantId: "organizations", // Allow work/school accounts only
      // tenantId: "consumers", // Allow personal accounts only
      // tenantId: "your-tenant-id", // Your specific organization only
      
      // Profile photo size (default is 48x48)
      // profilePhotoSize: 48, // Supported: 48, 64, 96, 120, 240, 360, 432, 504, 648
    })
  ],
  debug: true,
  // Callback URL will be: /api/auth/callback/microsoft-entra-id
} satisfies NextAuthConfig 