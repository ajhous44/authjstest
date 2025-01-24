import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      {session ? (
        <div>
          Signed in as {session.user?.email}
          <form action="/api/auth/signout" method="POST">
            <button type="submit">Sign out</button>
          </form>
        </div>
      ) : (
        <form action="/api/auth/signin" method="POST">
          <button type="submit">Sign in</button>
        </form>
      )}
    </main>
  );
}
