import { NextRequest, NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';

// 필요한 환경변수 (서버 전용)
// AZURE_STORAGE_CONNECTION_STRING, AZURE_STORAGE_CONTAINER (옵션, 기본 'works')

function getBlobService() {
  const raw = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!raw) throw new Error('AZURE_STORAGE_CONNECTION_STRING not set');
  if (/yourAccount/i.test(raw) || /YOUR_KEY/i.test(raw)) {
    throw new Error('AZURE_STORAGE_CONNECTION_STRING placeholder (yourAccount / YOUR_KEY) 를 실제 값으로 변경하세요');
  }

  // 1) 표준 계정 연결 문자열 패턴: AccountName=...;AccountKey=...
  const hasAccountKey = /AccountKey=/i.test(raw);
  const hasBlobEndpoint = /BlobEndpoint=/i.test(raw);
  const hasSas = /SharedAccessSignature=/i.test(raw) || /;sig=/i.test(raw);

  // 2) SAS 포맷 처리: BlobEndpoint + (SharedAccessSignature= 또는 ?sv=...&sig=...)
  if (!hasAccountKey && (hasBlobEndpoint || hasSas)) {
  // BlobEndpoint=... 추출
    let endpointMatch = raw.match(/BlobEndpoint=([^;]+);?/i);
    let endpoint = endpointMatch ? endpointMatch[1].trim() : '';
    if (!endpoint) {
      throw new Error('Invalid SAS Connection String: BlobEndpoint 누락');
    }
  // SAS 토큰 추출 (SharedAccessSignature= 로 명시적이거나 전체 문자열에 ?sv= 포함)
    let sasToken = '';
    const sasExplicit = raw.match(/SharedAccessSignature=([^;]+);?/i);
    if (sasExplicit) {
      sasToken = sasExplicit[1].trim();
      if (!sasToken.startsWith('?')) sasToken = '?' + sasToken;
    } else {
  // 대체(fallback): 전체 문자열에서 ?sv= 로 시작하는 부분 찾아 사용
      const qIndex = raw.indexOf('?sv=');
      if (qIndex >= 0) sasToken = raw.substring(qIndex).split(/\s/)[0];
    }
    if (!sasToken) throw new Error('Invalid SAS Connection String: SAS 토큰을 찾을 수 없습니다');
  // 조합: endpoint + sasToken
    const url = endpoint + sasToken;
    return new BlobServiceClient(url);
  }

  // 3) 그 외는 표준 AccountName/AccountKey 연결 문자열로 간주
  return BlobServiceClient.fromConnectionString(raw);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data 필요' }, { status: 400 });
    }

    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file 필드가 필요' }, { status: 400 });
    }

    const originalName = (file as File).name || 'capture.png';
    const ext = originalName.includes('.') ? originalName.split('.').pop() : 'png';
  // 클라이언트에서 선택적으로 workId 또는 filename 전달 가능
    const workId = formData.get('workId');
    const customBase = formData.get('filename');
    const now = new Date();
    const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const random = Math.random().toString(36).slice(2, 10);
    let blobName: string;
    if (typeof customBase === 'string' && customBase.trim()) {
  // filename 이 확장자 포함 안 되어 있으면 ext 추가
      const base = customBase.replace(/\s+/g, '_');
      blobName = base.endsWith(`.${ext}`) ? base : `${base}.${ext}`;
    } else if (typeof workId === 'string' && workId.trim()) {
  blobName = `work-${workId}.${ext}`; // 동일 workId 재업로드 시 덮어쓰기 (의도적)
    } else {
  blobName = `work-${stamp}-${random}.${ext}`; // 랜덤 방식 (workId/filename 미지정)
    }

    const containerName = process.env.AZURE_STORAGE_CONTAINER || 'works';
    const service = getBlobService();
    const container = service.getContainerClient(containerName);
  // SAS 토큰 기반 서비스인지 여부: accountKey 없음 + 서비스 URL에 sv= 포함 시
    const isSasService = !/AccountKey=/i.test(process.env.AZURE_STORAGE_CONNECTION_STRING || '') && /sv=/.test(service.url);
    if (!isSasService) {
      try {
        await container.createIfNotExists({ access: 'container' });
      } catch (err: any) {
        console.warn('[upload API] container create warning', err?.code, err?.message);
      }
    }

    const arrayBuffer = await (file as File).arrayBuffer();
    const blockBlob = container.getBlockBlobClient(blobName);
    await blockBlob.uploadData(Buffer.from(arrayBuffer), {
      blobHTTPHeaders: { blobContentType: (file as File).type || 'image/png' },
    });

  const publicUrl = blockBlob.url; // 컨테이너 ACL 이 public 인 경우, (필요 시 추후 SAS 추가 가능)

  return NextResponse.json({ url: publicUrl, name: blobName });
  } catch (e: any) {
  // Azure SDK 오류 포맷(RestError) 세부 추출
    const diag: Record<string, any> = {
      message: e?.message,
      code: e?.code,
      statusCode: e?.statusCode,
      requestId: e?.requestId || e?.response?.headers?.get?.('x-ms-request-id'),
      details: e?.details,
    };
  // 과도한 정보(키 등) 노출 가능성은 낮지만 방어적 로그
    console.error('[upload API] error', diag);

  // 일부 공통 패턴을 사용자 친화적 메시지로 변환
    let userMsg = diag.message || 'upload 실패';
    if (diag.code === 'OutOfRangeInput') {
      userMsg = 'Azure: 요청 입력값이 허용 범위를 벗어났습니다 (파일 크기 / 이름 / 헤더 값 확인).';
    } else if (/placeholder/i.test(userMsg)) {
      userMsg = '환경변수에 예시 값이 그대로 남아 있습니다. 실제 스토리지 계정 연결 문자열을 넣어주세요.';
    } else if (diag.code === 'AuthenticationFailed') {
      userMsg = 'Azure 인증 실패: 연결 문자열(AccountName/Key) 혹은 시스템 시계를 확인하세요.';
    }

    return NextResponse.json({ error: userMsg, diag }, { status: 500 });
  }
}
