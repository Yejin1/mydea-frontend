import { NextResponse } from "next/server";

function getBase() {
  const raw = (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim();
  return raw.replace(/\/$/, "");
}

async function forward(r: Response) {
  if (r.status === 204 || r.status === 304) {
    return new NextResponse(null, { status: r.status });
  }
  const contentType = r.headers.get("content-type") || "application/json";
  const text = await r.text();
  return new NextResponse(text, {
    status: r.status,
    headers: { "content-type": contentType },
  });
}

export async function GET(req: Request) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  const url = new URL(req.url);
  const target = `${base}/api/works${url.search}`;
  const r = await fetch(target, { cache: "no-store" });
  return forward(r);
}

export async function POST(req: Request) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  const body = await req.text();
  const r = await fetch(`${base}/api/works`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  return forward(r);
}

export async function DELETE(req: Request) {
  const base = getBase();
  if (!base)
    return NextResponse.json(
      { error: "API base not configured" },
      { status: 500 }
    );
  const body = await req.text();
  const r = await fetch(`${base}/api/works`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body,
  });
  return forward(r);
}
