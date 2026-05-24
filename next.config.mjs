/** @type {import('next').NextConfig} */
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "deadcampus";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (process.env.GITHUB_PAGES === "true" ? `/${repositoryName}` : "");

const nextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath
  }
};

export default nextConfig;
