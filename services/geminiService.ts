import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";
import { Attachment } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;
let currentChatModel: string = 'gemini-1.5-flash';

export const MODEL_OPTIONS = [
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Stable)', type: 'stable' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Latest)', type: 'preview' },
  { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Exp)', type: 'preview' },
];

// UPDATED SYSTEM PROMPT: Adaptive Behavior
const SPARK_SYSTEM_INSTRUCTION = `
You are Spark AI, a highly intelligent, friendly, and versatile AI assistant.

**CORE BEHAVIOR (General Mode):**
- Act exactly like ChatGPT: helpful, natural, adaptive, and conversational.
- You can write code, search the web, tell jokes, and help with daily tasks.
- Keep answers clear, concise, and relevant to the user's question.

**SPECIAL EDUCATIONAL MODE (Biology/Science Only):**
IF AND ONLY IF the user asks about a topic related to **Biology, Anatomy, Zoology, Botany, or Medical Science** (e.g., "Explain Lipids", "What is the Heart?", "Define Photosynthesis"), you must strictly follow this "Student Bio Sketch" structure:

1. **Discovery / History**
   - Mention the scientist and the **exact year** (e.g., 1890) of discovery if known.
2. **Professional Definition**
   - Clear, student-friendly definition.
3. **Types / Categories**
   - List types with brief examples.
4. **Importance / Functions**
   - Bullet points of main roles.
5. **Mechanism** (Optional)
   - Simple explanation of how it works.
6. **Visual / Diagram** (Optional)
   - Only if explicitly asked (use ASCII).
7. **Summary**
   - A one-sentence takeaway.

**CRITICAL:**
- Do NOT use the Bio Sketch format for normal questions like "How are you?", "Generate an image of a cat", or "Write python code".
- Use the General Mode for everything else.
`;

export const initializeChat = (modelId: string = 'gemini-1.5-flash', systemInstruction?: string) => {
  currentChatModel = modelId;
  chatSession = ai.chats.create({
    model: modelId,
    config: {
      systemInstruction: systemInstruction || SPARK_SYSTEM_INSTRUCTION,
    },
  });
};

export const sendChatMessage = async (message: string, modelId?: string): Promise<{ text: string; groundingUrls?: Array<{ title: string; uri: string }> }> => {
  // Re-initialize if model changed or session is null
  if (!chatSession || (modelId && modelId !== currentChatModel)) {
      initializeChat(modelId);
  }

  try {
    const response: GenerateContentResponse = await chatSession!.sendMessage({
      message: message
    });

    const text = response.text || "I couldn't generate a text response.";
    
    const groundingUrls: Array<{ title: string; uri: string }> = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web) {
          groundingUrls.push({ title: chunk.web.title, uri: chunk.web.uri });
        }
      });
    }

    return { text, groundingUrls };
  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};

export const sendSearchMessage = async (message: string, modelId: string = 'gemini-1.5-flash') => {
   try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents: message,
        config: {
          tools: [{googleSearch: {}}],
        },
      });
      
      const text = response.text || "I found some results.";
      const groundingUrls: Array<{ title: string; uri: string }> = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (chunks) {
        chunks.forEach((chunk: any) => {
          if (chunk.web) {
            groundingUrls.push({ title: chunk.web.title, uri: chunk.web.uri });
          }
        });
      }
      
      return { text, groundingUrls };
   } catch (error) {
     console.error("Search Error:", error);
     throw error;
   }
};

export const generateImage = async (prompt: string, aspectRatio: string): Promise<string> => {
  if (!prompt || !prompt.trim()) {
    throw new Error("A text prompt is required to generate an image.");
  }

  // Primary Strategy: Use Imagen 3 Stable
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001', 
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio, 
      },
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64ImageBytes) {
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
  } catch (error) {
    console.warn("Imagen 3 failed, attempting fallback...", error);
  }

  // Fallback Strategy: Use Gemini 2.0 Flash Exp
  try {
    const response = await ai.models.generateImages({
      model: 'gemini-2.0-flash-exp', 
      prompt: prompt,
      config: {
        numberOfImages: 1,
        outputMimeType: 'image/jpeg',
        aspectRatio: aspectRatio, 
      },
    });

    const base64ImageBytes = response.generatedImages?.[0]?.image?.imageBytes;
    if (base64ImageBytes) {
        return `data:image/jpeg;base64,${base64ImageBytes}`;
    }
    
    throw new Error("No image generated. The prompt might have been blocked by safety filters.");
  } catch (error) {
    console.error("Image Gen Error:", error);
    throw error;
  }
};

export const generateWithImages = async (prompt: string, attachments: Attachment[], aspectRatio: string): Promise<string> => {
  try {
      // Step 1: Analyze using a vision-capable model
      const parts: any[] = [];
      attachments.forEach(att => {
        parts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: att.data
          }
        });
      });
      
      parts.push({ text: `
      Analyze these images in extreme detail. 
      - If there is a person, describe their face, hair, age, ethnicity, and expression precisely. 
      - If there is clothing, describe it.
      - If there is a background, describe it.
      
      YOUR TASK: Provide a detailed visual description that can be used to recreate this character/scene in an image generator. 
      Focus on physical traits for identity preservation.
      ` });

      const analysisResponse = await ai.models.generateContent({
          model: 'gemini-1.5-flash',
          contents: { parts: parts }
      });

      const visualDescription = analysisResponse.text || "";

      // Step 2: Construct a merged prompt
      const finalPrompt = `
      ${prompt}
      
      VISUAL REFERENCE DETAILS (Strictly follow these traits):
      ${visualDescription}
      
      Style: Photorealistic, High Quality.
      `;

      // Step 3: Generate using the image model (Reusing the robust generateImage function logic here ideally, but calling directly for simplicity)
      
      // Try Imagen 3 first
      try {
        const imageResponse = await ai.models.generateImages({
            model: 'imagen-3.0-generate-001',
            prompt: finalPrompt,
            config: {
            numberOfImages: 1,
            outputMimeType: 'image/jpeg',
            aspectRatio: aspectRatio, 
            },
        });
        const b64 = imageResponse.generatedImages?.[0]?.image?.imageBytes;
        if (b64) return `data:image/jpeg;base64,${b64}`;
      } catch (e) {
         // Fallback inside multimodal
      }

      // Fallback to Gemini 2.0
      const imageResponse = await ai.models.generateImages({
        model: 'gemini-2.0-flash-exp',
        prompt: finalPrompt,
        config: {
          numberOfImages: 1,
          outputMimeType: 'image/jpeg',
          aspectRatio: aspectRatio, 
        },
      });

      const base64ImageBytes = imageResponse.generatedImages?.[0]?.image?.imageBytes;
      if (base64ImageBytes) {
          return `data:image/jpeg;base64,${base64ImageBytes}`;
      }

      throw new Error("No image generated from multimodal request.");
  } catch (error) {
      console.error("Multimodal Gen Error", error);
      throw error;
  }
}

export const analyzeImage = async (prompt: string, attachments: Attachment[], modelId: string = 'gemini-1.5-flash') => {
    try {
        const parts: any[] = [];
        attachments.forEach(att => {
           parts.push({
             inlineData: { mimeType: att.mimeType, data: att.data }
           });
        });
        parts.push({ text: prompt });

        const response = await ai.models.generateContent({
            model: modelId,
            contents: {
              parts: parts
            }
        });
        return response.text;
    } catch (error) {
        console.error("Vision Error", error);
        throw error;
    }
}