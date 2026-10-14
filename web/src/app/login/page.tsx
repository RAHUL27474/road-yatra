import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { otpAvailable } from "@/lib/otp";

export const metadata = { title: "Login" };
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" otpEnabled={otpAvailable("PHONE")} emailOtpEnabled={otpAvailable("EMAIL")} />
    </Suspense>
  );
}
