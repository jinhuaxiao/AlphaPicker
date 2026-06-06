import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { getSeller } from "@/lib/queries";

export async function GET() {
  const seller = await getSeller();
  return NextResponse.json({ seller });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const seller = await getSeller();
  if (!seller) {
    return NextResponse.json({ error: "no seller" }, { status: 404 });
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    fields.push(`${col} = $${i++}`);
    values.push(val);
  };

  if (body.experience !== undefined) set("experience", body.experience);
  if (body.sales_band !== undefined) set("sales_band", body.sales_band);
  if (body.categories !== undefined) set("categories", body.categories);
  if (body.risk_preference !== undefined) set("risk_preference", body.risk_preference);
  if (body.per_product_budget_cny !== undefined)
    set("per_product_budget_cny", body.per_product_budget_cny);
  if (body.platforms !== undefined) set("platforms", body.platforms);
  if (body.onboarded !== undefined) set("onboarded", body.onboarded);

  if (fields.length === 0) {
    return NextResponse.json({ seller });
  }

  values.push(seller.id);
  await pool.query(
    `UPDATE sellers SET ${fields.join(", ")} WHERE id = $${i}`,
    values as never[],
  );

  return NextResponse.json({ ok: true });
}
