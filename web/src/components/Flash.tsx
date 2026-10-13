/** Shows ?error= / success messages passed back from admin server actions. */
export default function Flash({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (success) return <p className="mb-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">{success}</p>;
  return null;
}
