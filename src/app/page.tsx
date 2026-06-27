const features = [
  {
    title: "App Router",
    description:
      "Built on the Next.js App Router with React Server Components and file-based routing.",
  },
  {
    title: "TypeScript",
    description:
      "End-to-end type safety so refactors stay fast and bugs get caught early.",
  },
  {
    title: "Tailwind CSS",
    description:
      "Utility-first styling for rapid, consistent, and responsive UI development.",
  },
  {
    title: "Production Ready",
    description:
      "Optimized builds, ESLint configured, and ready to deploy on Vercel.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center bg-gradient-to-b from-zinc-50 to-zinc-100 font-sans dark:from-black dark:to-zinc-950">
      <main className="flex w-full max-w-4xl flex-1 flex-col items-center gap-16 px-6 py-20 sm:py-28">
        <header className="flex flex-col items-center gap-6 text-center">
          <span className="rounded-full border border-black/10 bg-white/60 px-4 py-1.5 text-sm font-medium text-zinc-600 backdrop-blur dark:border-white/15 dark:bg-white/5 dark:text-zinc-300">
            LAUNCH 26 · Stack Kings
          </span>
          <h1 className="bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl dark:from-zinc-50 dark:to-zinc-400">
            Stack Kings
          </h1>
          <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            A sample Next.js application scaffolded with TypeScript and Tailwind
            CSS. Use it as a starting point for the LAUNCH 26 project.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              className="flex h-12 items-center justify-center rounded-full bg-zinc-900 px-6 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
              href="https://nextjs.org/docs"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read the docs
            </a>
            <a
              className="flex h-12 items-center justify-center rounded-full border border-black/10 px-6 text-base font-medium text-zinc-900 transition-colors hover:bg-black/5 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/5"
              href="https://github.com/inusha-thathsara/LAUNCH-26-_-Stack-Kings"
              target="_blank"
              rel="noopener noreferrer"
            >
              View on GitHub
            </a>
          </div>
        </header>

        <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-black/10 bg-white/70 p-6 backdrop-blur transition-colors hover:border-black/20 dark:border-white/10 dark:bg-white/5 dark:hover:border-white/20"
            >
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {feature.description}
              </p>
            </div>
          ))}
        </section>

        <code className="rounded-lg bg-zinc-900 px-4 py-2 text-sm text-zinc-100 dark:bg-zinc-800">
          npm run dev
        </code>
      </main>

      <footer className="w-full border-t border-black/10 py-6 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-500">
        Built with Next.js · LAUNCH 26 — Stack Kings
      </footer>
    </div>
  );
}
