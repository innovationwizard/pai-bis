import { redirect } from "next/navigation";
import { getPageUser } from "@/lib/auth";
import LoginForm from "./login-form";

export default async function LoginPage() {
  const user = await getPageUser();
  if (user) {
    const role = user.app_metadata?.role as string | undefined;
    if (role === "ventas") {
      redirect("/old/ventas/dashboard");
    } else {
      redirect("/");
    }
  }

  return (
    <section className="p-[clamp(16px,4vw,32px)] grid gap-[clamp(16px,3vw,28px)]">
      <div className="bg-card rounded-2xl p-4 shadow-card grid gap-2" style={{ maxWidth: 420, margin: "0 auto" }}>
        <h2 style={{ margin: 0 }}>Ingresar</h2>
        <p className="text-muted m-0">
          Accede con tu correo y contraseña.
        </p>
        <LoginForm />
      </div>
    </section>
  );
}
