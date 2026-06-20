/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Cloudinary — where /api/upload stores user-submitted photos (car
      // listings, dealer docs, profile avatars). Without this, next/image
      // refuses to render any uploaded photo.
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
};
module.exports = nextConfig;
