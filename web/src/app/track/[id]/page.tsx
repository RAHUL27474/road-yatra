import TrackView from "./TrackView";

export const metadata = { title: "Live tracking" };

export default async function TrackPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const [{ id }, { t }] = await Promise.all([params, searchParams]);
  return (
    <div className="container-x max-w-3xl py-6">
      <TrackView bookingId={id} token={t ?? ""} supportPhone={process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? ""} />
    </div>
  );
}
