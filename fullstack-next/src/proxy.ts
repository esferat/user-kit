import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIES = ['UK_SESSION', 'UK_DEV_TOKEN'];

/**
 * Оптимистичная защита приватных маршрутов: без cookie сессии посетитель
 * отправляется на экран входа. Это только UX-редирект — настоящую авторизацию
 * выполняет бэкенд, а клиент подтверждает сессию запросом `GET /api/v1/me`.
 */
export function proxy(request: NextRequest): NextResponse {
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
  if (hasSession) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!api|login|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
