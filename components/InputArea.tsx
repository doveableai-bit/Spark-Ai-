import React, { useRef } from 'react';
import { Send, Mic, Paperclip, Sparkles, Image as ImageIcon, Search, X, Plus, UserRound, Palette } from 'lucide-react';
import { ASPECT_RATIOS, IMAGE_STYLES, Attachment } from '../types';

interface Props {
  onSend: () => void;
  isLoading: boolean;
  
  // Controlled State Props
  text: string;
  setText: (text: string) => void;
  mode: 'chat' | 'image' | 'search';
  setMode: (mode: 'chat' | 'image' | 'search') => void;
  aspectRatio: string;
  setAspectRatio: (ratio: string) => void;
  selectedStyle: string;
  setSelectedStyle: (style: string) => void;
  attachments: Attachment[];
  onAddAttachment: (attachment: Attachment) => void;
  onRemoveAttachment: (id: string) => void;
}

export const InputArea: React.FC<Props> = ({ 
  onSend, 
  isLoading,
  text,
  setText,
  mode,
  setMode,
  aspectRatio,
  setAspectRatio,
  selectedStyle,
  setSelectedStyle,
  attachments,
  onAddAttachment,
  onRemoveAttachment
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if ((text.trim() || attachments.length > 0) && !isLoading) {
        onSend();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
          (Array.from(files) as File[]).forEach(file => {
              const reader = new FileReader();
              reader.onloadend = () => {
                  const base64String = reader.result as string;
                  const base64Data = base64String.split(',')[1];
                  
                  onAddAttachment({
                      data: base64Data,
                      mimeType: file.type,
                      id: Date.now().toString() + Math.random().toString()
                  });
              };
              reader.readAsDataURL(file);
          });
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerFileInput = () => {
      fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Mode Selection Tabs */}
      <div className="flex justify-center mb-4">
        <div className="bg-slate-800/80 p-1 rounded-full inline-flex border border-slate-700 shadow-lg backdrop-blur-md">
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
              mode === 'chat' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles size={12} /> Chat
          </button>
          <button
            onClick={() => setMode('search')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
              mode === 'search' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Search size={12} /> Search
          </button>
          <button
            onClick={() => setMode('image')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-2 ${
              mode === 'image' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ImageIcon size={12} /> Generate
          </button>
        </div>
      </div>

      {/* Main Input Container */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-3xl shadow-2xl backdrop-blur-xl relative transition-all focus-within:ring-1 focus-within:ring-blue-500/50">
        
        {/* Image Gen Options Overlay */}
        {mode === 'image' && (
          <div className="flex flex-col divide-y divide-slate-700/50">
            {/* Row 1: Aspect Ratio */}
            <div className="px-4 py-2 flex items-center gap-3 overflow-x-auto scrollbar-hide">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                 <ImageIcon size={10} /> Ratio
               </span>
               {ASPECT_RATIOS.map((ratio) => (
                 <button
                   key={ratio.value}
                   onClick={() => setAspectRatio(ratio.value)}
                   className={`px-2 py-1 rounded text-[10px] whitespace-nowrap border transition-colors ${
                     aspectRatio === ratio.value 
                      ? 'bg-purple-500/20 border-purple-500/50 text-purple-300 font-medium' 
                      : 'bg-slate-700/30 border-transparent text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                   }`}
                 >
                   {ratio.label.split(' ')[1].replace(/[()]/g, '')} <span className="opacity-50 ml-0.5">{ratio.value}</span>
                 </button>
               ))}
            </div>

            {/* Row 2: Style */}
            <div className="px-4 py-2 flex items-center gap-3 overflow-x-auto scrollbar-hide">
               <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
                 <Palette size={10} /> Style
               </span>
               {IMAGE_STYLES.map((style) => (
                 <button
                   key={style.value}
                   onClick={() => setSelectedStyle(style.value)}
                   className={`px-2 py-1 rounded text-[10px] whitespace-nowrap border transition-colors ${
                     selectedStyle === style.value 
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-300 font-medium' 
                      : 'bg-slate-700/30 border-transparent text-slate-500 hover:bg-slate-700 hover:text-slate-300'
                   }`}
                 >
                   {style.label}
                 </button>
               ))}
            </div>
          </div>
        )}

        {/* Attachment Preview List */}
        {attachments.length > 0 && (
            <div className="px-4 pt-3 pb-0 flex gap-2 overflow-x-auto scrollbar-hide">
                {attachments.map((att) => (
                  <div key={att.id} className="relative inline-block shrink-0">
                      <img 
                          src={`data:${att.mimeType};base64,${att.data}`} 
                          alt="Preview" 
                          className="h-16 w-16 object-cover rounded-lg border border-slate-600"
                      />
                      <button 
                          onClick={() => onRemoveAttachment(att.id)}
                          className="absolute -top-2 -right-2 bg-slate-900 text-slate-400 rounded-full p-0.5 border border-slate-600 hover:text-red-400"
                      >
                          <X size={12} />
                      </button>
                  </div>
                ))}
                <button 
                    onClick={triggerFileInput}
                    className="h-16 w-16 rounded-lg border border-slate-600 border-dashed flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-slate-700/30 transition-colors shrink-0"
                >
                   <Plus size={20} />
                </button>
            </div>
        )}

        <div className="flex items-end gap-2 p-2">
          <div className="flex items-center pb-2 pl-2 gap-1">
            <input 
                type="file" 
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                multiple
                onChange={handleFileChange}
            />
            <button 
                onClick={triggerFileInput}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-full transition-colors"
                title="Add attachments"
            >
              <Paperclip size={20} />
            </button>
            <button 
                onClick={() => {
                  setMode('image');
                  triggerFileInput();
                }}
                className="p-2 text-slate-400 hover:text-purple-300 hover:bg-purple-900/30 rounded-full transition-colors"
                title="Upload Face Reference"
            >
              <UserRound size={20} />
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'image' ? 
                (attachments.length > 0 ? "Describe how to use this reference image..." : "Describe the image you want to generate...") : 
              mode === 'search' ? "Ask a question to search the web..." :
              "Message Spark AI..."
            }
            className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm md:text-base p-3 max-h-32 min-h-[50px] resize-none focus:outline-none custom-scrollbar"
            rows={1}
            style={{ height: 'auto', minHeight: '50px' }} 
          />

          <div className="flex items-center pb-2 pr-2 gap-1">
             <button className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 rounded-full transition-colors hidden sm:block">
                 <Mic size={20} />
             </button>

            <button
              onClick={onSend}
              disabled={(!text.trim() && attachments.length === 0) || isLoading}
              className={`p-3 rounded-full transition-all transform ${
                (!text.trim() && attachments.length === 0) || isLoading
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                  : mode === 'image' ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20 hover:scale-105' :
                    mode === 'search' ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 hover:scale-105' :
                    'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 hover:scale-105'
              }`}
            >
              {isLoading ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                 <Send size={20} strokeWidth={2.5} className={mode !== 'chat' ? 'ml-0.5' : ''} />
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="text-center mt-3">
        <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
          <UserRound size={10} className="text-purple-400" />
          <span>Use the <strong>Face Reference</strong> button to keep characters consistent!</span>
        </p>
      </div>
    </div>
  );
};