import { NextResponse } from "next/server";
import { killNode, killLink, restoreAll, chaosState } from "../../../lib/chaosStore";

export async function POST(request) {
  const body = await request.json();

  if (body.action === "kill-node") {
    killNode(body.node_id);
  }

  if (body.action === "kill-link") {
    killLink(body.from, body.to);
  }

  if (body.action === "restore-all") {
    restoreAll();
  }

  return NextResponse.json({
    success: true,
    chaos: chaosState,
  });
}