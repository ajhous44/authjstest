/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/api/auth/:path*',
          has: [
            {
              type: 'header',
              key: 'x-use-proxy',
              value: 'true',
            },
          ],
          destination: process.env.HTTPS_PROXY
            ? `${process.env.HTTPS_PROXY}/:path*`
            : '/api/auth/:path*',
        },
      ],
    }
  },
}

module.exports = nextConfig 