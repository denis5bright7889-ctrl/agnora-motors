import { NextResponse } from "next/server";
import { addCar, listCars } from "@/lib/cars-store";

export async function GET() {
  return NextResponse.json({ cars: listCars() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body?.title || "").trim();
    const price = Number(body?.price);
    const image = String(body?.image || "").trim();
    const description = typeof body?.description === "string" ? body.description.trim() : "";

    if (!title) {
      return NextResponse.json({ error: "Title is required." }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0) {
      return NextResponse.json({ error: "Price must be a valid number." }, { status: 400 });
    }

    const car = addCar({
      title,
      price,
      image,
      description,
    });

    return NextResponse.json({ car }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }
}
