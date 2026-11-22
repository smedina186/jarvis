import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Public commit identifier only. Never expose provider keys via this object.
  env: { NEXT_PUBLIC_JARVIS_RELEASE: /^[a-f0-9]{40}$/i.test(process.env.COMMIT_REF || "") ? process.env.COMMIT_REF!.slice(0, 12) : "local" },
  async headers() {
    return [{ source: "/:path*", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self' https://github.com" },
      ...(process.env.NODE_ENV === "production" ? [
        { key: "Strict-Transport-Security", value: "max-age=31536000" },
      ] : []),
    ] }];
  },
};

export default nextConfig;
