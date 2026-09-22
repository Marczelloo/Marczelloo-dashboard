import { NextResponse, type NextRequest } from "next/server";
import { isOwnerEmail } from "@/server/lib/auth-policy";
import { resolveIdentity } from "@/server/lib/cloudflare-access";
import { isPublicPath } from "@/server/lib/public-paths";

export async function proxy(request: NextRequest) {
  if (process.env.DEMO_MODE === "true" || isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const identity = await resolveIdentity(request.headers);
  if (identity && isOwnerEmail(identity.email)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ success: false, error: "Sign in through Cloudflare Access first." }, { status: 401 });
  }

  return new NextResponse("Access denied. Open the dashboard at https://dashboard.marczelloo.dev and sign in through Cloudflare Access.", {
    status: 403,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon).*)"],
};
