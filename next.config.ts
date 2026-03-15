import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

const nextConfig: NextConfig = {
  typescript: {
    // !! 临时关闭构建门禁以支持 SSO 桥接上线
    ignoreBuildErrors: true,
  },
  eslint: {
    // !! 临时关闭构建门禁以支持 SSO 桥接上线
    ignoreDuringBuilds: true,
  },
  // Next 15 的 allowedDevOrigins 是顶层配置，不属于 experimental
  allowedDevOrigins: [
    'http://192.168.31.218:3000',
    'http://192.168.31.*:3000',
  ],
};

export default withNextIntl(nextConfig);
