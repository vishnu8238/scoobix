/**
 * Universal AI assistant — one component, five apps.
 *
 * Customer  → food assistant (recommendations, offers, trending)
 * Partner / Rider / Manager / Admin → support assistant with role context
 *
 * Every turn is persisted to `ai_chat_history`; escalation hands over to the
 * existing human support ticket flow.
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles, X, Mic } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/format";
import { useAuth } from "@/lib/auth-store";
import { logAiChat, runAI } from "@/lib/ai/client";
import type { AiTask } from "@/lib/ai/tasks";

type Turn = { role: "user" | "assistant"; text: string; escalate?: boolean };

export function AiAssistant({
  app,
  task = "support_answer",
  title = "Scoobix AI",
  greeting,
  suggestions = [],
  context,
  supportHref,
}: {
  app: string;
  task?: AiTask;
  title?: string;
  greeting?: string;
  suggestions?: string[];
  /** Grounding data (menus, orders, offers…) — sanitised server-side. */
  context?: unknown;
  supportHref?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const sessionId = useRef(`s_${Math.random().toString(36).slice(2, 10)}`);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const ask = async (question: string) => {
    const q = question.trim();
    if (!q || busy) return;
    setValue("");
    setTurns((t) => [...t, { role: "user", text: q }]);
    setBusy(true);
    void logAiChat({ userId: user?.id, app, sessionId: sessionId.current, role: "user", message: q, task });

    const res = await runAI<string>(
      task,
      {
        question: q,
        history: turns.slice(-6).map((t) => `${t.role}: ${t.text}`),
        context: context ?? null,
        now: new Date().toISOString(),
      },
      { app, userId: user?.id, fresh: true },
    );

    const text = res.ok
      ? (typeof res.data === "string" ? res.data : res.text)
      : "I can't reach the assistant right now. Please try again, or raise a support ticket.";
    const escalate = /ESCALATE\s*$/i.test(text.trim());
    setTurns((t) => [...t, { role: "assistant", text: text.replace(/ESCALATE\s*$/i, "").trim(), escalate }]);
    void logAiChat({ userId: user?.id, app, sessionId: sessionId.current, role: "assistant", message: text, task });
    setBusy(false);
  };

  const startVoice = () => {
    if (typeof window === "undefined") return;
    const SR: any = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.lang = "en-IN";
      rec.interimResults = false;
      rec.onstart = () => setListening(true);
      rec.onend = () => setListening(false);
      rec.onerror = () => setListening(false);
      rec.onresult = (e: any) => {
        const t = e.results?.[0]?.[0]?.transcript ?? "";
        if (t) void ask(t);
      };
      rec.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open AI assistant"
        className="fixed bottom-24 right-4 z-40 grid h-12 w-12 place-items-center rounded-full gradient-primary text-primary-foreground shadow-lg transition active:scale-95"
      >
        <Sparkles className="h-5 w-5" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 backdrop-blur-[2px]" onClick={() => setOpen(false)}>
          <div
            className="flex max-h-[86svh] flex-col rounded-t-3xl bg-card shadow-2xl ring-1 ring-border/60"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-primary-soft text-primary">
                <Sparkles className="h-4.5 w-4.5" strokeWidth={2.4} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold leading-tight">{title}</p>
                <p className="text-[11px] text-muted-foreground">Answers grounded in your Scoobix data</p>
              </div>
              <button onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-full bg-secondary">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {turns.length === 0 && (
                <>
                  <p className="rounded-2xl bg-muted/50 px-3 py-3 text-sm text-foreground/90">
                    {greeting ?? "Hi! Ask me anything — I'll use your live Scoobix data to answer."}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => ask(s)}
                        className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 hover:bg-primary-soft/40"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {turns.map((t, i) => (
                <div key={i} className={cn("flex", t.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed",
                      t.role === "user" ? "gradient-primary text-primary-foreground" : "bg-muted/60 text-foreground/90",
                    )}
                  >
                    {t.text}
                    {t.escalate && supportHref && (
                      <Link to={supportHref} className="mt-2 block text-xs font-bold underline">
                        Talk to a human →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>

            <div className="flex items-center gap-2 border-t border-border/60 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask(value)}
                placeholder="Ask anything…"
                className="h-11 flex-1 rounded-full bg-secondary px-4 text-sm outline-none ring-1 ring-border/60 focus:ring-primary"
              />
              <button
                onClick={startVoice}
                aria-label="Voice input"
                className={cn("grid h-10 w-10 place-items-center rounded-full", listening ? "bg-primary text-primary-foreground animate-pulse" : "bg-primary/10 text-primary")}
              >
                <Mic className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => ask(value)}
                disabled={busy || !value.trim()}
                aria-label="Send"
                className="grid h-10 w-10 place-items-center rounded-full gradient-primary text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
