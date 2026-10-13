import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { smsConfigured } from "@/lib/notify";

export const metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" otpEnabled={smsConfigured() || process.env.OTP_DEV_MODE === "true"} />
    </Suspense>
  );
}
