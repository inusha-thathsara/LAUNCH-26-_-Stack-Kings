import { NextResponse } from "next/server";
import { getUniverse } from "../../../lib/simulator";

export async function GET() {
  return NextResponse.json(getUniverse());
}