import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIES = ['UK_SESSION', 'UK_DEV_TOKEN'];

/**
 * Публичные маршруты: доступны без cookie сессии. Корень — лендинг, его
 * открывает анонимный посетитель; `/login` дополнительно исключён матчером.
 */
const PUBLIC_ROUTES = new Set(['/']);

/**
 * Оптимистичная защита приватных маршрутов: без cookie сессии посетитель
 * отправляется на экран входа. Это только UX-редирект — настоящую авторизацию
 * выполняет бэкенд, а клиент подтверждает сессию запросом `GET /api/v1/me`.
 */
export function proxy(request: NextRequest): NextResponse {
  if (PUBLIC_ROUTES.has(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

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
