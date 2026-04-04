import { PlatformNav } from "@/components/platform-nav";
import { PlatformFooter } from "@/components/platform-footer";
import { SignInForm } from "@/components/forms/signin-form";

export default function SignInPage() {
  return (
    <>
      <PlatformNav />
      <SignInForm />
      <PlatformFooter />
    </>
  );
}
