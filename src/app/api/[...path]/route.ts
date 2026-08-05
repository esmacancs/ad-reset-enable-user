import { NextRequest } from 'next/server';
import { handleApiRequest } from '@/lib/api-handler';

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

export async function PUT(req: NextRequest) {
  return handleRequest(req);
}

export async function DELETE(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest): Promise<Response> {
  const { pathname, search } = new URL(req.url);
  // Strip the leading "/api" prefix so handlers see paths like "/auth/login"
  const apiPrefix = '/api';
  const routePath = pathname.startsWith(apiPrefix) ? pathname.slice(apiPrefix.length) : pathname;

  const searchParams = new URLSearchParams(search);
  const authHeader = req.headers.get('authorization');

  let body: any = undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.json();
    } catch {
      body = undefined;
    }
  }

  return handleApiRequest(req.method, routePath, body, authHeader, searchParams, req);
}
