import fs from "node:fs/promises";
import path from "node:path";

export const metadata = { title: "Photo credits" };

/** Photo credits and licences (required for Creative Commons photos). */
export default async function CreditsPage() {
  const text = await fs.readFile(path.join(process.cwd(), "public/images/CREDITS.md"), "utf8");
  return (
    <div className="container-x max-w-4xl py-10">
      <h1 className="page-title mb-4">Photo credits</h1>
      <pre className="card overflow-x-auto whitespace-pre-wrap p-5 text-xs leading-relaxed text-slate-700">{text}</pre>
    </div>
  );
}
