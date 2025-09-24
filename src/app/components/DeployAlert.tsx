"use client";

import { useEffect } from "react";

export default function DeployAlert() {
  useEffect(() => {
    alert(
      "(2025-09-24)\n로그인 기능 적용을 위한 배포 작업중입니다. 잠시 후 다시 접속해주세요"
    );
  }, []);
  return null;
}
