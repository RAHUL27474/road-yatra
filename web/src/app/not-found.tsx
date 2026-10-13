import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <p className="text-6xl">🧭</p>
      <h1 className="mt-4 text-2xl font-bold">Page not found</h1>
      <p className="text-slate-500">This page does not exist, or the link has expired.</p>
      <Link href="/" className="btn-primary mt-6">Go home</Link>
    </div>
  );
}
