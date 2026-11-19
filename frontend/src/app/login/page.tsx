import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
import { authenticationReady, ownerId } from "@/lib/private-config";

export const dynamic = "force-dynamic";

export default async function Login() {
  const ready = authenticationReady();
  if (ready) {
    const session = await auth();
    if (session?.user?.id === ownerId()) redirect("/");
  }
  return (
    <main className="private-shell login-shell">
      <section className="private-card login-card">
        <p className="private-eyebrow">ACCESO PERSONAL</p>
        <h1>JARVIS</h1>
        <p>Tu espacio privado. Solo la cuenta de GitHub autorizada puede entrar.</p>
        {ready ? (
          <form action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/" });
          }}>
            <button className="private-button" type="submit">Entrar con GitHub</button>
          </form>
        ) : (
          <p role="status" className="private-notice">
            Acceso cerrado: falta configurar el inicio de sesión privado.
            Consulta PRIVACIDAD_Y_DESPLIEGUE.md en el proyecto.
          </p>
        )}
        <p className="private-small">Si tu cuenta no está autorizada, no podrás iniciar sesión.</p>
      </section>
    </main>
  );
}
