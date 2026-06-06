import { NextResponse } from "next/server";
import { analyzeProductImage } from "@/lib/dashscope";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { image } = await req.json();
  if (!image || typeof image !== "string") {
    return NextResponse.json({ error: "missing image" }, { status: 400 });
  }
  try {
    const guess = await analyzeProductImage(image);
    return NextResponse.json(guess);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
