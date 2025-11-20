import { GoogleGenAI, Chat, GenerateContentResponse, Modality } from "@google/genai";
import { Attachment } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

let chatSession: Chat | null = null;
let currentChatModel: string = 'gemini-2.0-flash';

export const MODEL_OPTIONS = [
  { id: 'gemini-2.0-pro-exp-02-05', name: 'Gemini 2.0 Pro (Newest Smartest)', type: 'preview' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Newest Fast)', type: 'preview' },
  { id: 'gemini-1.5-pro-001', name: 'Gemini 1.5 Pro (Stable Reasoning)', type: 'stable' },
  { id: 'gemini-1.5-flash-001', name: 'Gemini 1.5 Flash (Stable Fast)', type: 'stable' },
];

const SPARK_SYSTEM_INSTRUCTION = `
You are a professional, student-friendly educational assistant. Your task is to explain any topic in a clear, simple, and easy-to-understand way for students. Before giving a detailed explanation, provide a brief note on who discovered the topic and the exact year/date of discovery, if applicable.

Follow this structure:

1. **Discovery / History (Optional)**
- Mention the scientist who discovered the topic and the **exact year** (e.g., 1890) or date.
- Keep it short and relevant.
- Example: "Lipids were first detailed by Michel-Eugène Chevreul in **1823**."

2. **Professional Definition**
- Give a clear, professional definition of the topic.
- Use simple and easy-to-read language suitable for students.
- Example: "Lipids are biomolecules including fats, oils, waxes, and sterols, essential for energy storage, cell structure, and other vital functions."

3. **Types / Categories (if applicable)**
- Explain different types or categories.
- Include structure, characteristics, or key points for each type.
- Give examples for each type.
- Example format:
  - **Type Name**: Description (Example)

4. **Importance / Functions**
- List main roles/functions in bullet points.
- Include short examples if possible.
- Example format:
  - **Function Name**: Explanation.

5. **Mechanism / How it Works (Optional)**
- Explain processes in simple terms if applicable (digestion, absorption, chemical reactions, etc.).
- Add health implications, benefits, or risks if relevant.

6. **Visual / Summary Diagram (Optional)**
- Only include a visual/tree diagram if the user explicitly asks for "visual", "sketch", or "diagram".
- Use ASCII text structure (e.g., ├── ).

7. **Final Summary (Optional)**
- Summarize key points in a few lines.
- Highlight main functions, importance, and takeaways.

**Instructions for Chatbot:**
- **Default Mode**: For any explanation request (especially Biology/Science), STRICTLY follow the structure above.
- **History**: Always include the exact year (e.g. 1890) in the discovery section if known.
- **Visuals**: Do not show the diagram unless requested.
- **Tone**: Professional, unique, structured, and easy for students.
- **Other Tasks**: If the user asks to generate images, search the web, or write code, perform those tasks effectively while maintaining a helpful, professional tone, but you do not need to force the biology structure on non-educational requests.
`;

export const initializeChat = (modelId: string = 'gemini-2.0-flash', systemInstruction?: string) => {
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

export const sendSearchMessage = async (message: string, modelId: string = 'gemini-2.0-flash') => {
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

  try {
    // Always use the latest preview model for Image Gen as it has the best capabilities
    // or fallback to stable imagen if needed.
    const response = await ai.models.generateImages({
      model: 'gemini-2.0-flash', 
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
      // Step 1: Analyze using a vision-capable model (1.5 Flash is great for this)
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
          model: 'gemini-1.5-flash-001',
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

      // Step 3: Generate using the strong image model
      const imageResponse = await ai.models.generateImages({
        model: 'gemini-2.0-flash',
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

export const analyzeImage = async (prompt: string, attachments: Attachment[], modelId: string = 'gemini-2.0-flash') => {
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