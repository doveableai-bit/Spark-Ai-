import React from 'react';
import { ChatMessage, MessageRole, MessageType } from '../types';
import { Copy, RotateCw, ThumbsUp, ThumbsDown, Download, Image as ImageIcon, ExternalLink } from 'lucide-react';

interface Props {
  message: ChatMessage;
  onReuse?: (content: string, aspectRatio?: string) => void;
}

export const ChatMessageBubble: React.FC<Props> = ({ message, onReuse }) => {
  const isUser = message.role === MessageRole.USER;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadImage = (dataUrl: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `spark-ai-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-6 px-4">
        <div className="bg-blue-600 text-white px-5 py-3 rounded-2xl rounded-tr-none max-w-[85%] shadow-lg text-sm md:text-base font-medium leading-relaxed">
          {message.content.startsWith('data:image') ? (
             <img src={message.content} alt="Uploaded" className="max-h-40 rounded-lg" />
          ) : (
             message.content
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start mb-8 px-4 w-full max-w-4xl mx-auto animate-fade-in-up">
      {/* Avatar / Icon */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-indigo-500/20">
          ✨
        </div>
        <span className="text-xs font-semibold text-slate-400 tracking-wide">SPARK AI</span>
      </div>

      {/* Content Bubble */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl rounded-tl-none w-full p-5 shadow-xl backdrop-blur-sm">
        
        {message.type === MessageType.TEXT && (
          <div className="prose prose-invert prose-sm max-w-none">
             <div className="whitespace-pre-wrap text-slate-200 leading-relaxed">
                {message.content}
             </div>
             
             {/* Grounding Sources */}
             {message.metadata?.groundingUrls && message.metadata.groundingUrls.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">Sources</p>
                    <div className="flex flex-wrap gap-2">
                        {message.metadata.groundingUrls.map((url, idx) => (
                            <a 
                                key={idx} 
                                href={url.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 bg-slate-900 hover:bg-slate-700 border border-slate-700 rounded-md px-2 py-1 text-xs text-blue-400 transition-colors"
                            >
                                <ExternalLink size={10} />
                                <span className="truncate max-w-[150px]">{url.title}</span>
                            </a>
                        ))}
                    </div>
                </div>
             )}
          </div>
        )}

        {message.type === MessageType.IMAGE && (
          <div className="flex flex-col">
             <div className="text-sm text-slate-400 mb-3 italic border-l-2 border-blue-500 pl-3 flex flex-wrap items-center gap-2">
               <span>{message.metadata?.prompt}</span>
               {message.metadata?.aspectRatio && (
                 <span className="not-italic text-[10px] font-mono bg-slate-700/80 text-purple-300 border border-slate-600 px-1.5 py-0.5 rounded ml-1">
                   {message.metadata.aspectRatio}
                 </span>
               )}
             </div>
             <div className="relative group rounded-lg overflow-hidden bg-black/20">
                <img 
                  src={message.content} 
                  alt="Generated" 
                  className="w-full h-auto object-contain max-h-[500px] rounded-lg"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                    <p className="text-white font-medium pointer-events-none">AI Generated Image</p>
                </div>
             </div>
             
             {/* Image specific actions */}
             <div className="grid grid-cols-3 gap-2 mt-4 border-t border-slate-700/50 pt-3">
                <button 
                    onClick={() => onReuse && onReuse(message.content, message.metadata?.aspectRatio)}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-slate-700/30"
                >
                    <ImageIcon size={16} />
                    <span className="text-[10px]">Reuse</span>
                </button>
                <button 
                    onClick={() => downloadImage(message.content)}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-slate-700/30"
                >
                    <Download size={16} />
                    <span className="text-[10px]">Download</span>
                </button>
                <button 
                    onClick={() => message.metadata?.prompt && copyToClipboard(message.metadata.prompt)}
                    className="flex flex-col items-center gap-1 text-slate-400 hover:text-blue-400 transition-colors p-2 rounded-lg hover:bg-slate-700/30"
                >
                    <Copy size={16} />
                    <span className="text-[10px]">Prompt</span>
                </button>
             </div>
          </div>
        )}

        {message.type === MessageType.ERROR && (
           <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/50">
              Error: {message.content}
           </div>
        )}
      </div>

      {/* Common Actions Bar */}
      <div className="flex items-center gap-4 mt-2 px-1">
         <button 
            onClick={() => copyToClipboard(message.type === MessageType.TEXT ? message.content : message.metadata?.prompt || '')}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            title="Copy"
         >
           <Copy size={14} />
         </button>
         <button className="text-slate-500 hover:text-green-400 transition-colors">
           <ThumbsUp size={14} />
         </button>
         <button className="text-slate-500 hover:text-red-400 transition-colors">
           <ThumbsDown size={14} />
         </button>
      </div>
    </div>
  );
};