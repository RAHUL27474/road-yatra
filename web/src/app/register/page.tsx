import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { otpAvailable } from "@/lib/otp";

export const metadata = { title: "Sign up" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" otpEnabled={otpAvailable("PHONE")} emailOtpEnabled={otpAvailable("EMAIL")} />
    </Suspense>
  );
}
