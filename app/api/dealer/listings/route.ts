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
import { assessDescription, describeDescriptionProblem } from "@/lib/description-quality";
import type { CarStatus } from "@/types";

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

    // This path had no description validation at all — the body went straight
    // to createDealerCar, so a dealer could publish the same keyboard mash
    // that the public /api/cars path now refuses. Status is assigned
    // explicitly rather than inherited, so an uncertain description cannot
    // reach 'active' by taking the column default.
    const description = assessDescription(body?.description);
    if (description.verdict === "reject") {
      return NextResponse.json(
        {
          error: describeDescriptionProblem(description),
          code:  "description_rejected",
        },
        { status: 400 },
      );
    }

    const requestedStatus: CarStatus = body?.status ?? "active";
    const status: CarStatus =
      description.verdict === "review" && requestedStatus === "active"
        ? "pending_review"
        : requestedStatus;

    const car = await createDealerCar(dealer.id, { ...body, status });
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
