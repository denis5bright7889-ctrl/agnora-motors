"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { ContactModal } from "./contact-modal";
import type { Car } from "@/types";

export function ContactButton({ car }: Readonly<{ car: Car }>) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-white text-sm font-semibold hover:opacity-90 transition-opacity"
      >
        <MessageCircle className="h-4 w-4" /> Contact dealer
      </button>
      {open && (
        <ContactModal
          carTitle={`${car.year} ${car.make} ${car.model}`}
          dealerName={car.dealer.name}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}