import type { NextConfig } from "next";

// 이미지 최적화에서 외부(Blob Storage) 호스트 사용 허용
// 오류 원인: next/image 는 외부 도메인 사용 시 next.config 의 images 설정에 명시가 필요
//   Invalid src prop ... hostname "mydea.blob.core.windows.net" is not configured ...
// 해결: images.remotePatterns 또는 images.domains 에 호스트 추가
// remotePatterns 를 사용하면 protocol / path 제약 가능 (SAS 쿼리스트링은 무시됨)

const config: NextConfig = {
  output: "standalone",
  images: {
    // 최소 제약 패턴: works 컨테이너 내부 파일만 허용
    remotePatterns: [
      {
        protocol: "https",
        hostname: "mydea.blob.core.windows.net",
        port: "",
        pathname: "/works/**",
      },
    ],
    // 필요 시 다른 컨테이너/경로 추가 가능
    // domains: ["mydea.blob.core.windows.net"], // (대안) 경로 제한 불필요하면 이 배열만 사용
  },
};

export default config;
