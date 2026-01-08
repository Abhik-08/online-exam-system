// src/utils/geminiClient.ts
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const responseSchema = {
  description: "List of multiple choice questions",
  type: SchemaType.OBJECT,
  properties: {
    questions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          question: { type: SchemaType.STRING },
          options: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            minItems: 4,
            maxItems: 4,
          },
          correctAnswer: {
            type: SchemaType.NUMBER,
            description: "Zero-based index of the correct answer (0-3)",
          },
        },
        required: ["question", "options", "correctAnswer"],
      },
    },
  },
  required: ["questions"],
};

export async function generateQuestionsWithGemini(
  subject: string,
  chapter: string,
  count: number = 5
) {
  try {
    const model = genAI.getGenerativeModel(
      { model: "gemini-2.5-flash" },
      { apiVersion: "v1beta" }
    );

    const BATCH_SIZE = 5; // safe Gemini batch
    let allQuestions: any[] = [];

    while (allQuestions.length < count) {
      const remaining = count - allQuestions.length;
      const currentBatchSize = Math.min(BATCH_SIZE, remaining);

      const prompt = `Generate exactly ${currentBatchSize} MCQs for Subject: ${subject}, Topic: ${chapter}. Ensure options are clear and only one is correct.`;

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      const response = await result.response;
      const data = JSON.parse(response.text());

      if (data?.questions?.length) {
        allQuestions.push(...data.questions);
      } else {
        break; // safety exit
      }
    }

    return allQuestions.slice(0, count);

  } catch (error: any) {
    console.error("Gemini SDK Error:", error);

    if (error.message?.includes("429")) {
      throw new Error(
        "AI is currently busy (Rate Limit). Please wait 30–60 seconds and try again."
      );
    }

    throw new Error(error.message || "Failed to generate questions");
  }
}
