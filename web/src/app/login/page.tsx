import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { smsConfigured } from "@/lib/notify";

export const metadata = { title: "Login" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" otpEnabled={smsConfigured() || process.env.OTP_DEV_MODE === "true"} />
    </Suspense>
  );
}
