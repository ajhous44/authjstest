import { auth, signIn, signOut } from "@/auth";
import Image from "next/image";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        {session ? (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-bold">Welcome {session.user?.name}</h1>
            <div className="flex items-center gap-4">
              {session.user?.image && (
                <div className="relative w-12 h-12">
                  <Image
                    src={session.user.image}
                    alt={session.user.name ?? "Profile"}
                    fill
                    className="rounded-full object-cover"
                    sizes="48px"
                  />
                </div>
              )}
              <p>{session.user?.email}</p>
            </div>
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button
                type="submit"
                className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-bold">Welcome to Auth.js Demo</h1>
            <form
              action={async () => {
                "use server";
                await signIn("microsoft-entra-id");
              }}
            >
              <button
                type="submit"
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
              >
                Sign in with Microsoft
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}
