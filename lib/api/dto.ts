// DTO serializers for Platform API v1. These define the PUBLIC contract so
// the database schema can evolve without breaking mobile/web clients — never
// return lib/SQL shapes directly from a v1 endpoint.

import type { Lead } from "@/lib/leads";
import type { Review, Complaint } from "@/lib/trust";
import type { Milestone } from "@/lib/reputation";
import type { DealerCar } from "@/types";

export function leadDTO(l: Lead) {
  return {
    id: l.id,
    buyer: { name: l.buyerName, email: l.buyerEmail, phone: l.buyerPhone },
    message: l.message,
    status: l.status,
    source: l.source,
    notes: l.notes,
    lastContactAt: l.lastContactAt,
    createdAt: l.createdAt,
    vehicle: l.carMake
      ? { year: l.carYear, make: l.carMake, model: l.carModel, slug: l.carSlug }
      : null,
  };
}

export function reviewDTO(r: Review) {
  return {
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    breakdown: {
      communication: r.communication,
      vehicleAccuracy: r.vehicleAccuracy,
      professionalism: r.professionalism,
    },
    wouldRecommend: r.wouldRecommend,
    body: r.body,
    verified: r.purchaseVerified,
    createdAt: r.createdAt,
  };
}

export function complaintDTO(c: Complaint) {
  return {
    id: c.id,
    category: c.category,
    detail: c.detail,
    status: c.status,
    dealerResponse: c.dealerResponse,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    vehicle: c.carMake ? { year: c.carYear, make: c.carMake, model: c.carModel } : null,
  };
}

export function vehicleDTO(c: DealerCar) {
  return {
    id: c.id,
    slug: c.slug,
    year: c.year,
    make: c.make,
    model: c.model,
    trim: c.trim ?? null,
    price: c.price,
    mileage: c.mileage,
    fuel: c.fuel,
    transmission: c.transmission,
    bodyType: c.bodyType,
    condition: c.condition,
    location: c.location,
    image: c.images?.[0] ?? null,
    status: c.status,
    views: c.views ?? 0,
    inquiries: c.inquiries ?? 0,
  };
}

export function milestoneDTO(m: Milestone) {
  return { type: m.type, label: m.label, date: m.createdAt };
}
