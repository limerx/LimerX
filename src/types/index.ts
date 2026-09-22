export interface ChatMessageSource {
  articleRef: string | null;
  pageNumber: number | null;
  excerpt: string;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatMessageSource[];
}
