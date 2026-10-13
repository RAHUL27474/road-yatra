import { MessageCircle, Phone } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { whatsappLink } from "@/lib/media";
import HeaderBar from "./HeaderBar";

export default async function Header() {
  const user = await getCurrentUser();
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";
  return (
    <>
      <div className="no-print relative bg-brand-darker text-xs text-blue-100">
        <div className="container-x flex h-9 items-center justify-between gap-3">
          <p className="deva shrink-0 text-[13px] font-semibold tracking-wide text-gold">॥ जय श्री श्याम ॥</p>
          <p className="hidden truncate md:block">
            <span className="font-semibold text-white">Your Journey Our Priority</span>
            <span className="mx-2 text-blue-300/60">|</span>
            Safe · Comfortable · Reliable
            <span className="mx-2 text-blue-300/60">|</span>
            Service day &amp; night
          </p>
          {phone && (
            <div className="flex shrink-0 items-center gap-3">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 font-semibold text-white hover:text-gold">
                <Phone className="h-3.5 w-3.5" aria-hidden /> {phone}
              </a>
              <a href={whatsappLink(phone)} target="_blank" rel="noopener" className="hidden items-center gap-1.5 hover:text-gold sm:flex" aria-label="Chat on WhatsApp">
                <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
              </a>
            </div>
          )}
        </div>
        <div className="saffron-gradient absolute inset-x-0 bottom-0 h-[2px]" aria-hidden />
      </div>
      <HeaderBar
        brand={brand}
        supportPhone={phone}
        user={user ? { firstName: user.name.split(" ")[0], isAdmin: user.role === "ADMIN" } : null}
      />
    </>
  );
}
