import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/server/auth/session";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/app");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-semibold">Sign in to PixelHub</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Demo credentials are pre-filled.
      </p>
      <AuthForm mode="login" />
    </main>
  );
}
