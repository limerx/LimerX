export interface ChatMessageSource {
  articleRef: string | null;
  pageNumber: number | null;
  excerpt: string;
  pageImageUrl?: string | null;
}

export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: ChatMessageSource[];
}
