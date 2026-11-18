// Minimal stand-in for next/server, used only by the test runner.
//
// Next exports "next/server" under bundler-only resolution conditions, so bare
// Node cannot load it and any route handler importing it is untestable. The
// alias hook resolves the specifier here instead.
//
// NextResponse.json is the only part route handlers use. A standard Response
// carries the status and the JSON body faithfully, which is what the tests
// assert; this is a narrower surface than the real class, not a different one.

export const NextResponse = {
  json(body, init = {}) {
    return new Response(JSON.stringify(body), {
      status: init.status ?? 200,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
  },

  redirect(url, status = 307) {
    return new Response(null, { status, headers: { location: String(url) } });
  },

  next() {
    return new Response(null, { status: 200 });
  },
};

export class NextRequest extends Request {}
