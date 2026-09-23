import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  throw new Error("GEMINI_API_KEY manquant dans l'environnement.");
}

const genAI = new GoogleGenerativeAI(apiKey);

const EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-latest";
// Doit rester en phase avec `vector(N)` dans db/schema.sql. gemini-embedding-001 produit
// 3072 dimensions par defaut ; on les tronque via outputDimensionality pour rester compact.
const EMBEDDING_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS ?? 768);

/**
 * Vectorise un texte pour la recherche/indexation RAG.
 * `taskType` distingue le mode indexation (document) du mode requete (query),
 * ce qui ameliore la pertinence de la recherche avec les modeles Gemini.
 */
export async function embedText(
  text: string,
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const result = await model.embedContent({
    content: { role: "user", parts: [{ text }] },
    taskType: taskType as never,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  } as never);
  return result.embedding.values;
}

export async function embedTexts(
  texts: string[],
  taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
): Promise<number[][]> {
  // L'API batchEmbedContents limite le nombre d'elements par appel ; on traite par lots.
  const BATCH_SIZE = 100;
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
  const out: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const result = await model.batchEmbedContents({
      requests: batch.map((text) => ({
        model: EMBEDDING_MODEL,
        content: { role: "user", parts: [{ text }] },
        taskType: taskType as never,
        outputDimensionality: EMBEDDING_DIMENSIONS,
      })) as never,
    });
    out.push(...result.embeddings.map((e) => e.values));
  }

  return out;
}

export interface ChatSource {
  articleRef: string | null;
  pageNumber: number | null;
  excerpt: string;
}

const SYSTEM_INSTRUCTION = `Tu es un assistant expert de la norme electrique NF C15-100 (et d'autres normes techniques fournies).
Regles strictes :
1. Reponds UNIQUEMENT a partir des extraits fournis dans le contexte ci-dessous. N'invente jamais une regle ou une valeur.
2. Si le contexte ne contient pas l'information demandee, dis-le clairement et invite l'utilisateur a reformuler ou a consulter un professionnel qualifie.
3. Reste precis, technique et concis. Pas de blabla.
4. Ne mentionne jamais de numero d'article, de section, de tableau ou de page dans ta reponse (pas de "selon l'article X", pas de "page X", pas de "cf. tableau Y") : integre l'information directement dans une explication naturelle, comme le ferait un expert qui repond de memoire.`;

export async function generateAnswer(
  question: string,
  contextChunks: ChatSource[],
  history: { role: "user" | "assistant"; content: string }[] = []
) {
  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const context = contextChunks
    .map(
      (c, i) =>
        `[Extrait ${i + 1}]${c.articleRef ? ` (Article ${c.articleRef})` : ""}${
          c.pageNumber ? ` (page ${c.pageNumber})` : ""
        }\n${c.excerpt}`
    )
    .join("\n\n");

  const prompt = `Contexte extrait de la norme :\n\n${context || "(aucun extrait pertinent trouve)"}\n\nQuestion de l'utilisateur : ${question}`;

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
  });

  const result = await chat.sendMessage(prompt);
  return result.response.text();
}

export async function* generateAnswerStream(
  question: string,
  contextChunks: ChatSource[],
  history: { role: "user" | "assistant"; content: string }[] = []
) {
  const model = genAI.getGenerativeModel({
    model: CHAT_MODEL,
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const context = contextChunks
    .map(
      (c, i) =>
        `[Extrait ${i + 1}]${c.articleRef ? ` (Article ${c.articleRef})` : ""}${
          c.pageNumber ? ` (page ${c.pageNumber})` : ""
        }\n${c.excerpt}`
    )
    .join("\n\n");

  const prompt = `Contexte extrait de la norme :\n\n${context || "(aucun extrait pertinent trouve)"}\n\nQuestion de l'utilisateur : ${question}`;

  const chat = model.startChat({
    history: history.map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    })),
  });

  const result = await chat.sendMessageStream(prompt);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}
