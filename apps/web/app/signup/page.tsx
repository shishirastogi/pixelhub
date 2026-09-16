import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/server/auth/session";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold">Create your account</h1>
      <AuthForm mode="signup" />
    </main>
  );
}
