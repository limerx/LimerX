import type { ChatMessageData } from "@/types";

export function ChatMessage({ message }: { message: ChatMessageData }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-2xl rounded-lg px-4 py-3 text-sm ${
          isUser ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-900"
        }`}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>

        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="mt-3 border-t border-slate-100 pt-2">
            <p className="text-xs font-medium text-slate-500">Sources</p>
            <ul className="mt-1 space-y-1">
              {message.sources.map((s, i) => (
                <li key={i} className="text-xs text-slate-500">
                  {s.articleRef ? `Article ${s.articleRef}` : "Extrait"}
                  {s.pageNumber ? ` - page ${s.pageNumber}` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
