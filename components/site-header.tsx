import Link from "next/link";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export default async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b border-foreground">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="text-3xl font-display tracking-wide">
          AICD
        </Link>
        <nav className="flex items-center gap-3 text-sm uppercase tracking-[0.2em]">
          <Link href="/app" className="hover:opacity-70">
            Console
          </Link>
          {session ? (
            <Button asChild variant="secondary" className="h-10 px-6">
              <Link href="/app">Enter</Link>
            </Button>
          ) : (
            <Button asChild className="h-10 px-6">
              <Link href="/auth/signin">Sign in</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
