import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, MessageRole, MessageType, ASPECT_RATIOS, Attachment } from './types';
import { sendChatMessage, sendSearchMessage, generateImage, initializeChat, analyzeImage, generateWithImages, MODEL_OPTIONS } from './services/geminiService';
import { ChatMessageBubble } from './components/ChatMessageBubble';
import { InputArea } from './components/InputArea';
import { Sparkles, X, Image as ImageIcon, Check, ChevronDown } from 'lucide-react';

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showRatioModal, setShowRatioModal] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState('');
  
  // Model Selection State - Default to Gemini 2.0 Flash (Latest Fast)
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash'); 

  // Lifted State for Input Area
  const [inputText, setInputText] = useState('');
  const [appMode, setAppMode] = useState<'chat' | 'image' | 'search'>('chat');
  const [selectedRatio, setSelectedRatio] = useState('1:1');
  const [selectedStyle, setSelectedStyle] = useState('default'); // New Style State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Initialize with the default selected model
    initializeChat(selectedModel);
    
    // Welcome Message
    setMessages([
      {
        id: 'welcome',
        role: MessageRole.MODEL,
        type: MessageType.TEXT,
        content: "Hello! I am Spark AI, your multi-modal assistant. You can chat with me, ask me to generate or edit images, or search the web. \n\nTip: Use the selector in the top right to switch between AI models!",
        timestamp: Date.now()
      }
    ]);
  }, []);

  // Re-initialize chat when model changes
  const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value;
    setSelectedModel(newModel);
    initializeChat(newModel);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Helper to detect if text implies image generation
  const isImageGenerationRequest = (text: string): boolean => {
    const lower = text.toLowerCase();
    const keywords = [
      "generate image", "create image", "make an image", "draw a", "paint a", 
      "generate a picture", "create a picture", "make a picture", "generate photo",
      "create photo", "make a photo", "image of", "picture of",
      "create a portrait", "generate a portrait", "draw a portrait",
      "create a landscape", "generate a landscape", "draw a landscape"
    ];
    return keywords.some(k => lower.includes(k));
  };

  const handleConfirmRatio = (ratio: string) => {
    setShowRatioModal(false);
    if (pendingPrompt) {
      // Force mode to image with the selected ratio and send directly
      setAppMode('image');
      setSelectedRatio(ratio);
      handleSendInternal(pendingPrompt, 'image', ratio, [], selectedStyle);
      setPendingPrompt('');
      setInputText(''); 
    }
  };

  const handleCancelRatio = () => {
    setShowRatioModal(false);
    setPendingPrompt('');
  };

  const handleReuseImage = (dataUrl: string, aspectRatio?: string) => {
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (matches) {
       const mimeType = matches[1];
       const data = matches[2];
       const newAttachment: Attachment = {
         id: `reused-${Date.now()}`,
         mimeType,
         data
       };
       
       setAttachments([newAttachment]);
       setAppMode('image');
       
       if (aspectRatio) {
         setSelectedRatio(aspectRatio);
       }

       setInputText("Add my character to this image");
    }
  };

  const handleSend = () => {
     handleSendInternal(inputText, appMode, selectedRatio, attachments, selectedStyle);
     setInputText('');
     setAttachments([]);
     // Keep style setting sticky or reset? Usually sticky is better, or reset to default
     // setSelectedStyle('default'); 
  };

  const handleSendInternal = async (text: string, mode: 'chat' | 'image' | 'search', aspectRatio: string, currentAttachments: Attachment[], style: string) => {
    
    // INTERCEPTION LOGIC
    if (mode === 'chat' && currentAttachments.length === 0 && isImageGenerationRequest(text)) {
        setPendingPrompt(text);
        setShowRatioModal(true);
        return;
    }

    const userMsgId = Date.now().toString();
    
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: MessageRole.USER,
      type: MessageType.TEXT, 
      content: text || (currentAttachments.length > 0 ? `Sent ${currentAttachments.length} image(s)` : ""),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMsg]);
    setIsLoading(true);

    try {
      let responseContent = '';
      let responseType = MessageType.TEXT;
      let metadata: any = {};

      if (mode === 'image') {
        const finalAspectRatio = aspectRatio;
        let imageUrl;

        // 1. APPLY STYLE LOGIC
        let effectivePrompt = text;
        
        if (style !== 'default') {
             // User explicitly chose a style
             effectivePrompt = `${text}. Style: ${style}.`;
        } else {
             // Default Smart Behavior
             const styleKeywords = ["realistic", "photorealistic", "photo", "photography", "cartoon", "anime", "sketch", "painting"];
             const hasStyle = styleKeywords.some(k => text.toLowerCase().includes(k));
             if (!hasStyle) {
                 effectivePrompt = `Photorealistic image of ${text}`;
             }
        }

        if (currentAttachments.length > 0) {
           const lowerText = text.toLowerCase();
           const isDressChange = lowerText.includes("dress") || lowerText.includes("wear") || lowerText.includes("outfit") || lowerText.includes("uniform") || lowerText.includes("costume");
           const isBackgroundChange = lowerText.includes("background") || lowerText.includes("location") || lowerText.includes("place") || lowerText.includes("standing at") || lowerText.includes("sitting at");
           const isMerge = currentAttachments.length > 1 || lowerText.includes("add me") || lowerText.includes("add my character");

           const augmentedPrompt = `
TASK: Create a photorealistic image based on this description: "${effectivePrompt}".

INTENT:
${isDressChange ? `- The user wants to CHANGE CLOTHING. Keep the character's face/identity but change outfit to: ${text}.` : ''}
${isBackgroundChange && !isDressChange ? `- The user wants to CHANGE BACKGROUND. Keep the character's face/body but move them to: ${text}.` : ''}
${isMerge ? `- The user wants to MERGE a character into a scene.` : ''}

Note: Detailed visual traits of the reference images will be appended automatically.
`;
           
           imageUrl = await generateWithImages(augmentedPrompt, currentAttachments, finalAspectRatio);
        } else {
           // Standard generation
           imageUrl = await generateImage(effectivePrompt, finalAspectRatio);
        }
        responseContent = imageUrl;
        responseType = MessageType.IMAGE;
        metadata = { prompt: effectivePrompt, aspectRatio: finalAspectRatio };
      } else if (mode === 'search') {
        const result = await sendSearchMessage(text, selectedModel);
        responseContent = result.text;
        metadata = { groundingUrls: result.groundingUrls };
      } else {
        // Chat mode
        if (currentAttachments.length > 0) {
             const visionResponse = await analyzeImage(text || "Describe this image", currentAttachments, selectedModel);
             responseContent = visionResponse || "I analyzed the image.";
        } else {
            const result = await sendChatMessage(text, selectedModel);
            responseContent = result.text;
            metadata = { groundingUrls: result.groundingUrls };
        }
      }

      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        type: responseType,
        content: responseContent,
        timestamp: Date.now(),
        metadata
      };

      setMessages(prev => [...prev, aiMsg]);

    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: MessageRole.MODEL,
        type: MessageType.ERROR,
        content: error.message || "Something went wrong. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-50 relative overflow-hidden">
      {/* Ambient Background */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] opacity-50"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[150px] opacity-50"></div>
      </div>

      {/* Header */}
      <header className="glass z-10 px-6 py-4 sticky top-0 flex items-center justify-between border-b border-slate-800/50">
        <div className="flex items-center gap-2">
          <Sparkles className="text-indigo-400" fill="currentColor" size={20} />
          <h1 className="text-lg font-bold tracking-wide bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            SPARK AI
          </h1>
        </div>
        <div className="flex items-center gap-4">
           {/* Model Selector */}
           <div className="relative hidden sm:block group">
             <select 
               value={selectedModel}
               onChange={handleModelChange}
               className="appearance-none bg-slate-800 border border-slate-600 text-slate-300 text-xs font-mono py-1.5 pl-3 pr-8 rounded-md focus:outline-none focus:border-blue-500 cursor-pointer hover:bg-slate-700 transition-colors"
             >
               {MODEL_OPTIONS.map(model => (
                 <option key={model.id} value={model.id}>
                   {model.name}
                 </option>
               ))}
             </select>
             <ChevronDown size={14} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-500 pointer-events-none" />
           </div>

           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold border border-slate-500 shadow-md">
             U
           </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 relative z-0">
        <div className="max-w-4xl mx-auto min-h-full pb-32">
           {messages.map((msg) => (
             <ChatMessageBubble 
               key={msg.id} 
               message={msg} 
               onReuse={handleReuseImage}
             />
           ))}
           <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Input Footer */}
      <footer className="sticky bottom-0 z-20 p-4 md:p-6 bg-gradient-to-t from-slate-900 via-slate-900 to-transparent">
        <InputArea 
          onSend={handleSend} 
          isLoading={isLoading}
          
          text={inputText}
          setText={setInputText}
          mode={appMode}
          setMode={setAppMode}
          aspectRatio={selectedRatio}
          setAspectRatio={setSelectedRatio}
          selectedStyle={selectedStyle}
          setSelectedStyle={setSelectedStyle}
          attachments={attachments}
          onAddAttachment={(att) => setAttachments(prev => [...prev, att])}
          onRemoveAttachment={(id) => setAttachments(prev => prev.filter(a => a.id !== id))}
        />
      </footer>

      {/* Aspect Ratio Selection Modal (For Chat Mode Interception) */}
      {showRatioModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button 
              onClick={handleCancelRatio}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-600/20 rounded-xl text-purple-400">
                <ImageIcon size={24} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Select Image Size</h3>
                <p className="text-sm text-slate-400">Choose exact dimensions for your image</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ASPECT_RATIOS.map((ratio) => (
                <button
                  key={ratio.value}
                  onClick={() => handleConfirmRatio(ratio.value)}
                  className="group relative flex items-center justify-between p-4 bg-slate-900/50 hover:bg-slate-700 border border-slate-700 hover:border-purple-500/50 rounded-xl transition-all duration-200 text-left"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-200 group-hover:text-white">{ratio.label.split(' ')[1].replace(/[()]/g, '')}</span>
                    <span className="text-xs text-slate-500 font-mono group-hover:text-purple-300">{ratio.value}</span>
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-600 group-hover:border-purple-500/50 flex items-center justify-center">
                     <div 
                        className="bg-slate-500 group-hover:bg-purple-400 transition-colors"
                        style={{
                          width: ratio.value === '16:9' ? '20px' : ratio.value === '9:16' ? '10px' : '16px',
                          height: ratio.value === '16:9' ? '10px' : ratio.value === '9:16' ? '20px' : '16px',
                          borderRadius: '1px'
                        }}
                     />
                  </div>
                </button>
              ))}
            </div>

             <div className="mt-6 pt-4 border-t border-slate-700/50 flex justify-end">
               <button 
                 onClick={handleCancelRatio}
                 className="px-4 py-2 text-sm text-slate-400 hover:text-white font-medium"
               >
                 Cancel
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;