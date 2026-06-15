import { loadGoogleSheetsState, saveGoogleSheetsState, hasGoogleSheetsConfig } from "@/lib/googleSheetsState";
import type { AppState } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!hasGoogleSheetsConfig()) {
    return Response.json({ error: "Google Sheets persistence is not configured." }, { status: 503 });
  }

  try {
    return Response.json({ state: await loadGoogleSheetsState() });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to load Google Sheets state." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!hasGoogleSheetsConfig()) {
    return Response.json({ error: "Google Sheets persistence is not configured." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { state?: AppState };
    if (!body.state) {
      return Response.json({ error: "Missing state payload." }, { status: 400 });
    }

    await saveGoogleSheetsState(body.state);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Failed to save Google Sheets state." }, { status: 500 });
  }
}
