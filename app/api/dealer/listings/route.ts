import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDealerByUserId,
  createDealerCar,
  getDealerCars,
  deleteDealerCar,
  ListingQualityError,
} from "@/lib/db";
import { publishEvent } from "@/lib/realtime";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer || dealer.status !== "approved") {
    return NextResponse.json({ error: "Dealer not approved" }, { status: 403 });
  }

  const cars = await getDealerCars(dealer.id);
  return NextResponse.json({ cars });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer || dealer.status !== "approved") {
    return NextResponse.json({ error: "Dealer not approved" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const car = await createDealerCar(dealer.id, body);
    publishEvent("listing_created", {
      carId: car.id, make: car.make, model: car.model,
      year: car.year, price: car.price, dealerId: dealer.id,
    }).catch(() => {});
    return NextResponse.json({ car }, { status: 201 });
  } catch (err) {
    if (err instanceof ListingQualityError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error(err);
    return NextResponse.json({ error: "Failed to create listing" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dealer = await getDealerByUserId(session.user.id);
  if (!dealer) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing car id" }, { status: 400 });
  }

  await deleteDealerCar(id, dealer.id);
  return NextResponse.json({ ok: true });
}
