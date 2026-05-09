import { SignIn } from "@clerk/clerk-react";
import { useSearchParams } from "react-router-dom";

export default function SignInPage() {
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <SignIn
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
        afterSignInUrl={next}
        afterSignUpUrl={next}
      />
    </div>
  );
}
