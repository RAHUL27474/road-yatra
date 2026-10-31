import { CallIcon, WhatsAppIcon } from "@/components/BrandIcons";
import { whatsappLink } from "@/lib/media";
import HeaderBar from "./HeaderBar";

export default function Header() {
  const brand = process.env.NEXT_PUBLIC_BRAND_NAME || "Jai Shree Shyam Tour & Travels";
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "";
  return (
    <>
      <div className="no-print relative bg-brand-darker text-xs text-slate-300">
        <div className="container-x flex h-9 items-center justify-between gap-3">
          <p className="hidden truncate md:block">
            <span className="font-semibold text-white">Your Journey Our Priority</span>
            <span className="mx-2 text-slate-500">|</span>
            Safe · Comfortable · Reliable
            <span className="mx-2 text-slate-500">|</span>
            Service day &amp; night
          </p>
          {phone && (
            <div className="flex shrink-0 items-center gap-3">
              <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex items-center gap-1.5 font-semibold text-white hover:text-gold">
                <CallIcon className="h-3.5 w-3.5" /> {phone}
              </a>
              <a href={whatsappLink(phone)} target="_blank" rel="noopener" className="hidden items-center gap-1.5 hover:text-gold sm:flex" aria-label="Chat on WhatsApp">
                <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366]" /> WhatsApp
              </a>
            </div>
          )}
        </div>
      </div>
      {/* Who is logged in is looked up in the browser, so pages can be served pre-built. */}
      <HeaderBar brand={brand} supportPhone={phone} />
    </>
  );
}
