// The server serves the same SPA shell for every non-API path (a static
// fallback in src/index.ts), so the client itself must decide what a URL
// means. Previously App.tsx never looked at location.pathname at all:
// '/', '/login', '/dashboard', '/admin' and any random address all
// silently rendered the landing page. This module classifies the path
// the app was opened with so App.tsx can behave explicitly:
//
//   '/'                -> 'home'      landing page, exactly as before
//   '/login'           -> 'login'     landing page with the login modal open
//   '/dashboard',
//   '/admin'           -> 'dashboard' the signed-in user's dashboard when a
//                                     session exists, otherwise the landing
//                                     page with the login modal open
//   anything else      -> 'not-found' a branded 404 page, not the landing page
//
// Only the path the app starts on is classified; in-app navigation stays
// state-based, as it always has been in this codebase.

export type InitialPathKind = 'home' | 'login' | 'dashboard' | 'not-found';

export const classifyInitialPath = (pathname: string): InitialPathKind => {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  switch (normalized) {
    case '/':
      return 'home';
    case '/login':
      return 'login';
    case '/dashboard':
    case '/admin':
      return 'dashboard';
    default:
      return 'not-found';
  }
};
