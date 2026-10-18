import { getCurrentUser } from "@/lib/auth";
import FeedbackForm from "./FeedbackForm";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  return (
    <div className="container-x max-w-2xl py-10">
      <h1 className="page-title mb-1">Your feedback</h1>
      <p className="mb-6 text-sm text-slate-500">Rate us in one tap. Every message is read by our office.</p>
      <FeedbackForm user={user ? { name: user.name, phone: user.phone } : null} />
    </div>
  );
}
