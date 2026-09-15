import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 部署：输出独立运行包（.next/standalone），镜像无需整个 node_modules
  output: "standalone",
  allowedDevOrigins: ['192.168.1.105', '192.168.31.243', '192.168.64.177', '192.168.64.236', 'localhost', '127.0.0.1'],
};

export default nextConfig;
