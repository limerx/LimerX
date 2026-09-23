import type { ChatMessageData } from "@/types";

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  const pageImages = Array.from(
    new Map(
      (message.sources ?? [])
        .filter((s): s is typeof s & { pageImageUrl: string } => Boolean(s.pageImageUrl))
        .map((s) => [s.pageImageUrl, s])
    ).values()
  );

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-lg px-4 py-3 text-sm ${
          isUser ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-900"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {!isUser && pageImages.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {pageImages.map((s) => (
              <a
                key={s.pageImageUrl}
                href={s.pageImageUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-md border border-slate-200 hover:border-brand-400"
                title={`Voir la page ${s.pageNumber}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.pageImageUrl ?? undefined}
                  alt={`Page ${s.pageNumber} de la norme`}
                  className="h-28 w-auto"
                />
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
