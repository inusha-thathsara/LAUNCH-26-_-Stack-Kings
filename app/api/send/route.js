import { NextResponse } from "next/server";
import { sendPacket } from "../../../lib/simulator";

export async function POST(request) {
  try {
    const body = await request.json();

    const { origin_id, destination_id, payload } = body;

    if (!origin_id || !destination_id || !payload) {
      return NextResponse.json(
        { error: "origin_id, destination_id, and payload are required." },
        { status: 400 }
      );
    }

    const result = sendPacket(origin_id, destination_id, payload);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Packet sending failed." },
      { status: 500 }
    );
  }
}