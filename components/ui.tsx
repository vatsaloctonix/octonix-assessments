import React from "react";
import clsx from "clsx";

export function OctonixFrame(props: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="sticky top-0 z-10 border-b border-black/10 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full border border-black/15" />
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-wide">Octonix Solutions</div>
              <div className="text-[11px] text-black/60">Candidate Assessment</div>
            </div>
          </div>
          <div className="text-[11px] text-black/50">Minimal. Honest. Signal-focused.</div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5 py-8">{props.children}</main>
      <footer className="border-t border-black/10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-[11px] text-black/55">
          <div>© {new Date().getFullYear()} Octonix Solutions</div>
          <div>Built for clarity.</div>
        </div>
      </footer>
    </div>
  );
}

export function Card(props: { title?: string; children: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <section className={clsx("rounded-2xl border border-black/10 bg-white p-5 shadow-sm", props.className)}>
      {(props.title || props.right) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          {props.title ? <h2 className="text-sm font-semibold tracking-wide">{props.title}</h2> : <div />}
          {props.right}
        </div>
      )}
      {props.children}
    </section>
  );
}

export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const variant = props.variant ?? "primary";
  return (
    <button
      {...props}
      className={clsx(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-black text-white hover:bg-black/90",
        variant === "ghost" && "bg-transparent text-black hover:bg-black/5 border border-black/10",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        props.className
      )}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none",
        "focus:border-black/25",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none",
        "focus:border-black/25",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none",
        "focus:border-black/25",
        props.className
      )}
    />
  );
}

export function TinyLabel(props: { children: React.ReactNode }) {
  return <div className="mb-1 text-[11px] font-medium text-black/70">{props.children}</div>;
}

export function Muted(props: { children: React.ReactNode }) {
  return <div className="text-[12px] text-black/55">{props.children}</div>;
}

export function Divider() {
  return <div className="my-4 h-px w-full bg-black/10" />;
}
