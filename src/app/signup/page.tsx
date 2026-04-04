import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";
import { SignUpForm } from "@/components/forms/signup-form";

export default function SignUpPage() {
  return (
    <>
      <PlatformNav />
      <SignUpForm />
      <PlatformFooter />
    </>
  );
}
