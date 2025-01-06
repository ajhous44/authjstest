# Next.js with Microsoft Entra ID Authentication

This project demonstrates how to implement Microsoft Entra ID (formerly Azure AD) authentication in a Next.js application using Auth.js v5, with support for corporate proxies.

## Features

- Microsoft Entra ID authentication
- Corporate proxy support
- Profile photo fetching
- Protected routes
- TypeScript support
- Tailwind CSS styling

## Prerequisites

1. Node.js 18.17 or later
2. A Microsoft Entra ID (Azure AD) tenant
3. A registered application in Microsoft Entra ID

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory with the following variables:
```env
AZURE_AD_CLIENT_ID=your_client_id
AZURE_AD_CLIENT_SECRET=your_client_secret
AZURE_AD_TENANT_ID=your_tenant_id

# Optional: Proxy settings
# HTTP_PROXY=http://your-proxy:port
# HTTPS_PROXY=http://your-proxy:port

# Auth.js secret (Generate with: openssl rand -base64 32)
AUTH_SECRET=your_auth_secret
```

4. Configure your Microsoft Entra ID application:
   - Go to Azure Portal > Azure Active Directory > App registrations
   - Create or select your application
   - Add redirect URIs: `http://localhost:3000/api/auth/callback/microsoft-entra-id`
   - Note down the Application (client) ID and Directory (tenant) ID
   - Create a client secret and note it down
   - Configure API permissions (minimum required):
     - Microsoft Graph API
       - User.Read
       - email
       - openid
       - profile

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Corporate Proxy Support

If your organization uses a corporate proxy, set the proxy environment variables in your `.env.local` file:

```env
HTTP_PROXY=http://your-proxy:port
HTTPS_PROXY=http://your-proxy:port
```

The application will automatically detect and use these proxy settings for all authentication-related requests.

## Project Structure

- `src/app/` - Next.js application routes
- `src/auth.ts` - Auth.js configuration and Microsoft Entra ID setup
- `src/middleware.ts` - Route protection middleware
- `.env.local` - Environment variables

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
