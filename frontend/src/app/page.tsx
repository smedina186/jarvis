import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { authenticationReady, ownerId } from "@/lib/private-config";
import PrivateDashboard from "@/components/PrivateDashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!authenticationReady()) redirect("/login");
  const session = await auth();
  if (!session?.user || session.user.id !== ownerId()) redirect("/login");
  return (
    <main className="private-shell">
      <header className="private-header">
        <div><p className="private-eyebrow">ASISTENTE PERSONAL</p><h1>JARVIS</h1></div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="private-button secondary" type="submit">Cerrar sesión</button>
        </form>
      </header>
      <PrivateDashboard />
    </main>
  );
}
