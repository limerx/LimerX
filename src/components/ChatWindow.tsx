"use client";

import { useRef, useState, type FormEvent } from "react";
import { ChatMessage } from "@/components/ChatMessage";
import type { ChatMessageData, ChatMessageSource } from "@/types";

interface StreamEvent {
  type: "sources" | "chunk" | "done" | "error";
  conversationId?: string;
  sources?: ChatMessageSource[];
  text?: string;
  message?: string;
}

export function ChatWindow({ domainSlug }: { domainSlug: string }) {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const conversationIdRef = useRef<string | undefined>(undefined);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const question = input.trim();
    if (!question || loading) return;

    setInput("");
    setLoading(true);

    const userMessage: ChatMessageData = { id: crypto.randomUUID(), role: "user", content: question };
    const assistantId = crypto.randomUUID();
    setMessages((prev) => [...prev, userMessage, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domainSlug,
          question,
          conversationId: conversationIdRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("Reponse serveur invalide.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const event = JSON.parse(line.slice(6)) as StreamEvent;

          if (event.type === "sources" && event.conversationId) {
            conversationIdRef.current = event.conversationId;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, sources: event.sources } : m))
            );
          } else if (event.type === "chunk" && event.text) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: m.content + event.text } : m))
            );
          } else if (event.type === "error") {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content || "Une erreur est survenue. Reessayez." }
                  : m
              )
            );
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content: "Erreur de connexion. Reessayez." } : m
        )
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    // Le formulaire est en position fixed (ancre au viewport de l'ecran, pas au flux de la
    // page) : sur mobile, une hauteur basee sur flex+dvh seule s'est averee peu fiable des
    // que le clavier virtuel s'ouvre (l'input finissait hors champ / dans le scroll).
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <div
        className="flex-1 space-y-4 overflow-y-auto px-6 py-6"
        style={{ paddingBottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}
      >
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">
            Posez une question sur la norme, par exemple : "Quelle section minimale pour un
            circuit prise 16A ?"
          </p>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white px-6 py-4"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Votre question..."
            disabled={loading}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "..." : "Envoyer"}
          </button>
        </div>
      </form>
    </div>
  );
}
