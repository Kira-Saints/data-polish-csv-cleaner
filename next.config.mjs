/** @type {import('next').NextConfig} */
const nextConfig = {
  // In local development, proxy /api/* to the Python backend (uvicorn on port 8000).
  // In production on Vercel, /api/* is routed to the Python function by vercel.json.
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }];
  },
};

export default nextConfig;
