import Link from "next/link";

export default function NotFound() {
  return (
    <section className="wrap flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="kicker">404</span>
      <h1 className="mt-4 font-display text-4xl sm:text-5xl">Page not found</h1>
      <p className="mt-4 max-w-md text-cream/70">
        That page doesn't exist — but your new website could. Let's build it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-gold">Back home</Link>
        <Link href="/start" className="btn-outline">Start your project</Link>
      </div>
    </section>
  );
}
