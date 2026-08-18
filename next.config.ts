import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Nécessaire pour next/image sur les fichiers servis depuis le bucket
    // Storage Supabase (images de questions, avatars...).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "egugkdafigthwofqwsdr.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
