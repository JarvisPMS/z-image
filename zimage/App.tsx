
import React, { useState, useEffect, useRef } from 'react';
import { generateImage } from './services/api';
import { generateChat, generateChatStream } from './services/chat';
import { CHAT_MODELS, DEEPSEEK_MODEL_ID, DEFAULT_CHAT_MODEL_ID } from './constants';
import { ApiKeyInput } from './components/ApiKeyInput';
import { CustomSelect } from './components/CustomSelect';
import { SparklesIcon, ImageIcon, DownloadIcon, LoaderIcon, AlertCircleIcon, TrashIcon } from './components/Icons';
import logo from './logo.png';
import { LOCAL_STORAGE_KEY_API_KEY, DEFAULT_MODEL_ID, RESOLUTION_GROUPS, DEFAULT_RESOLUTION, AVAILABLE_MODELS, DOWNLOAD_LINKS } from './constants';
import { GeneratedImage } from './types';
import { translations, getSystemLanguage, Language } from './i18n';

export default function App() {
  const [language, setLanguage] = useState<Language>(getSystemLanguage());
  const t = translations[language];

  const [apiKey, setApiKey] = useState('');
  const [prompt, setPrompt] = useState('');
  const [selectedResolution, setSelectedResolution] = useState(DEFAULT_RESOLUTION);
  
  // Helper to find current group and ratio index based on selectedResolution
  const getCurrentIndices = () => {
    let groupIndex = 0;
    let ratioIndex = 0;
    RESOLUTION_GROUPS.forEach((group, gIdx) => {
        group.options.forEach((opt, rIdx) => {
            if (opt.value === selectedResolution.value) {
                groupIndex = gIdx;
                ratioIndex = rIdx;
            }
        });
    });
    return { groupIndex, ratioIndex };
  };

  const { groupIndex, ratioIndex } = getCurrentIndices();

  const handleGroupChange = (newGroupIndex: number) => {
      const newResolution = RESOLUTION_GROUPS[newGroupIndex].options[ratioIndex];
      setSelectedResolution(newResolution);
  };

  const handleRatioChange = (newRatioIndex: number) => {
      const newResolution = RESOLUTION_GROUPS[groupIndex].options[newRatioIndex];
      setSelectedResolution(newResolution);
  };

  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState<GeneratedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);

  const [chatPrompt, setChatPrompt] = useState('');
  const [chatAnswer, setChatAnswer] = useState<string>('');
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'chat'>('image');
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [selectedChatModel, setSelectedChatModel] = useState<string>(DEFAULT_CHAT_MODEL_ID);
  const chatListRef = useRef<HTMLDivElement>(null);
  const [showRateLimitNotice, setShowRateLimitNotice] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [chatAbortController, setChatAbortController] = useState<AbortController | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initial Load
  useEffect(() => {
    const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY_API_KEY);
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      const envKey = import.meta.env.VITE_MODELSCOPE_API_KEY;
      if (envKey) setApiKey(envKey);
    }

    // Focus textarea on load
    if (textareaRef.current) {
        textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem(LOCAL_STORAGE_KEY_API_KEY, key);
    setError(null);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    if (!apiKey) {
      setError(t.apiKeyError);
      return;
    }

    setLoading(true);
    setError(null);
    setShowRateLimitNotice(false);

    try {
      const imageUrl = await generateImage({
        prompt: prompt.trim(),
        apiKey,
        model: selectedModel,
        size: selectedResolution.value
      });

      const newImage: GeneratedImage = {
        url: imageUrl,
        prompt: prompt.trim(),
        createdAt: Date.now()
      };

      setCurrentImage(newImage);
      setHistory(prev => [newImage, ...prev]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (err instanceof Error) setError(err.message); else setError(t.unknownError);
      const lower = (msg || '').toLowerCase();
      if (lower.includes('429') || lower.includes('rate limit') || lower.includes('限流')) {
        setShowRateLimitNotice(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed, trying direct link", e);
      window.open(url, '_blank');
    }
  };

  const clearHistory = () => {
      setHistory([]);
      setCurrentImage(null);
  }

  const toggleLanguage = () => {
      setLanguage(prev => prev === 'en' ? 'zh' : 'en');
  }

  const handleAsk = async () => {
    if (!chatPrompt.trim()) return;
    if (!apiKey) { setError(t.apiKeyError); return; }
    setChatLoading(true);
    setError(null);
    setShowRateLimitNotice(false);
    const nextMessages = [...chatMessages, { role: 'user', content: chatPrompt.trim() }];
    const withAssistantSeed = [...nextMessages, { role: 'assistant', content: '' }];
    setChatMessages(withAssistantSeed);
    setChatPrompt('');
    try {
      const controller = new AbortController();
      setChatAbortController(controller);
      const answer = await generateChatStream({
        messages: nextMessages,
        apiKey,
        model: selectedChatModel,
        signal: controller.signal,
        onChunk: (text) => {
          setChatMessages(prev => {
            const arr = [...prev];
            const idx = arr.length - 1;
            if (idx >= 0 && arr[idx].role === 'assistant') {
              arr[idx] = { role: 'assistant', content: arr[idx].content + text };
            }
            return arr;
          });
        }
      });
      setChatAnswer(answer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (err instanceof Error) setError(err.message); else setError(t.unknownError);
      const lower = (msg || '').toLowerCase();
      if (lower.includes('429') || lower.includes('rate limit') || lower.includes('限流')) {
        setShowRateLimitNotice(true);
      }
    } finally {
      setChatLoading(false);
      setChatAbortController(null);
    }
  }

  const handleCancelChat = () => {
    if (chatAbortController) {
      chatAbortController.abort();
    }
  }

  const clearChat = () => {
    setChatMessages([]);
    setChatAnswer('');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-8 px-4 sm:px-6">
      
      {/* Header */}
      <header className="w-full max-w-4xl flex flex-col md:flex-row items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl overflow-hidden shadow-lg shadow-indigo-200">
                <img src={logo} alt="Jarvis Logo" className="w-full h-full object-cover" />
            </div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t.title}</h1>
                <p className="text-xs text-slate-500 font-medium">{t.subtitle}</p>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <ApiKeyInput 
                apiKey={apiKey} 
                onApiKeyChange={handleApiKeyChange} 
                labels={{
                    placeholder: t.apiKeyPlaceholder,
                    update: t.updateApiKey,
                    get: t.getApiKey,
                    save: t.saveKey,
                    cancel: t.cancel
                }}
            />
            <button
              onClick={() => setShowDownloadModal(true)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm flex items-center gap-1"
            >
              <DownloadIcon className="w-3 h-3" />
              {t.downloadApp}
            </button>
        </div>
        <div className="flex items-center gap-3 ml-auto">
            <button 
                onClick={toggleLanguage}
                className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600 transition-all shadow-sm"
            >
                {language === 'en' ? '中文' : 'English'}
            </button>
        </div>
      </header>

      {showRateLimitNotice && (
        <div className="w-full max-w-4xl mb-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
            <AlertCircleIcon className="w-4 h-4 mt-0.5" />
            <p className="text-sm">
              {t.rateLimitNotice}
              <a
                href="https://mp.weixin.qq.com/s/JW_eciEKlMCfyfnpt_LTIw"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-indigo-700 hover:text-indigo-800 ml-1"
              >
                {t.configTutorial}
              </a>
            </p>
          </div>
        </div>
      )}

      <main className="w-full max-w-4xl space-y-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('image')}
            className={`px-3 py-1.5 text-xs rounded-lg border ${activeTab==='image' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >{t.imageTab}</button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-3 py-1.5 text-xs rounded-lg border ${activeTab==='chat' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >{t.chatTab}</button>
        </div>
        
        {activeTab==='image' && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
            <div className="p-4">
                <label htmlFor="prompt" className="sr-only">{t.promptLabel}</label>
                <textarea
                    ref={textareaRef}
                    id="prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleGenerate();
                        }
                    }}
                    placeholder={t.promptPlaceholder}
                    className="w-full min-h-[100px] p-2 text-lg text-slate-800 placeholder-slate-400 border-none outline-none resize-none bg-transparent"
                />
            </div>
            
            {/* Options Bar */}
            <div className="bg-slate-50 px-4 py-3 border-t border-slate-100 flex flex-col gap-4 rounded-b-2xl">
                
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    
                    {/* Left Side: Model Selector */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t.modelLabel}</span>
                        <CustomSelect
                            value={selectedModel}
                            onChange={(val) => setSelectedModel(val)}
                            options={AVAILABLE_MODELS.map(model => ({ value: model.id, label: model.label }))}
                            className="flex-1 md:flex-none min-w-[200px]"
                        />
                    </div>

                    {/* Right Side: Resolution Selectors (Quality & Ratio) */}
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        
                        {/* Quality Selector */}
                        <div className="flex items-center gap-2 flex-1 md:flex-none">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t.qualityLabel}</span>
                            <CustomSelect
                                value={groupIndex}
                                onChange={(val) => handleGroupChange(Number(val))}
                                options={RESOLUTION_GROUPS.map((group, idx) => ({
                                    value: idx,
                                    // @ts-ignore - safe access
                                    label: t.qualities[group.name] || group.name
                                }))}
                                className="w-full md:w-[180px]"
                            />
                        </div>

                        {/* Ratio Selector */}
                        <div className="flex items-center gap-2 flex-1 md:flex-none">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t.ratioLabel}</span>
                            <CustomSelect
                                value={ratioIndex}
                                onChange={(val) => handleRatioChange(Number(val))}
                                options={RESOLUTION_GROUPS[groupIndex].options.map((option, idx) => {
                                    const simpleLabel = option.label.split(' ')[0];
                                    const translatedLabel = (t as any).ratios?.[simpleLabel] || simpleLabel;
                                    return { value: idx, label: translatedLabel };
                                })}
                                className="w-full md:w-[160px]"
                            />
                        </div>

                        {/* Display Current Resolution Hint */}
                        <div className="hidden md:block text-xs text-slate-400 font-mono bg-slate-100 px-2 py-1 rounded">
                            {selectedResolution.width}x{selectedResolution.height}
                        </div>

                    </div>

                </div>


                {/* Bottom Row: Generate Button */}
                <button
                    onClick={handleGenerate}
                    disabled={loading || !prompt.trim()}
                    className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 transform active:scale-95"
                >
                    {loading ? (
                        <>
                            <LoaderIcon className="w-5 h-5 animate-spin" />
                            <span>{t.creatingButton}</span>
                        </>
                    ) : (
                        <>
                            <SparklesIcon className="w-5 h-5" />
                            <span>{t.generateButton}</span>
                        </>
                    )}
                </button>

                {/* Usage Steps */}
                <div className="mt-6 p-4 bg-slate-50/50 rounded-xl border border-slate-100">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                        <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
                        {
                            // @ts-ignore
                            t.stepsTitle
                        }
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {
                            // @ts-ignore
                            t.steps.map((step: string, idx: number) => (
                            <div key={idx} className="flex items-start gap-2 text-xs text-slate-600">
                                <span className="flex-shrink-0 w-5 h-5 flex items-center justify-center bg-white rounded-full border border-slate-200 font-mono text-[10px] font-bold text-indigo-500 shadow-sm">
                                    {idx + 1}
                                </span>
                                <span className="mt-0.5 leading-relaxed">{step}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
        )}

        {activeTab==='chat' && (
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200">
          <div className="p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <span className="w-1 h-4 bg-indigo-500 rounded-full"></span>
              {(CHAT_MODELS.find(m => m.id === selectedChatModel)?.label || '') + ' ' + t.chatTitle}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{t.modelLabel}</span>
              <CustomSelect
                value={selectedChatModel}
                onChange={(val) => setSelectedChatModel(val)}
                options={CHAT_MODELS.map(m => ({ value: m.id, label: m.label }))}
                className="min-w-[220px]"
              />
              <button onClick={clearChat} className="ml-auto px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50">{t.clearChat}</button>
            </div>
            <div className="flex flex-col gap-3">
              <div ref={chatListRef} className="max-h-[40vh] overflow-auto space-y-2 p-2 bg-slate-50 rounded-lg border border-slate-100">
                {chatMessages.map((m, i) => {
                  const isUser = m.role === 'user';
                  return (
                    <div key={i} className={`w-full flex items-start gap-2 ${isUser ? 'justify-end' : ''}`}>
                      {!isUser && (
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full overflow-hidden shadow">
                            <img src={logo} alt="甲维斯" className="w-full h-full object-cover" />
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">甲维斯</div>
                        </div>
                      )}
                      <div className={`px-3 py-2 rounded-lg text-sm max-w-[70%] break-words ${isUser ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border border-slate-200'}`}>{m.content}</div>
                      {isUser && (
                        <div className="flex flex-col items-center">
                          <div className="w-7 h-7 rounded-full bg-slate-700 text-white flex items-center justify-center text-[10px]">用</div>
                          <div className="mt-1 text-[10px] text-slate-500">我</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <textarea
                value={chatPrompt}
                onChange={(e) => setChatPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAsk();
                  }
                }}
                placeholder={t.chatPromptPlaceholder}
                className="w-full min-h-[80px] p-2 text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-lg bg-white"
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAsk}
                  disabled={chatLoading || !chatPrompt.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
                >
                  {chatLoading ? t.creatingButton : t.askButton}
                </button>
                {chatLoading && (
                  <button
                    onClick={handleCancelChat}
                    className="px-3 py-2 bg-white border border-slate-200 text-slate-700 text-sm rounded-lg hover:bg-slate-50"
                  >
                    {t.cancel}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Error Message */}
        {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2">
                <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
            </div>
        )}

        {/* Results Section */}
        {activeTab==='image' && currentImage && (
            <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="relative group">
                         {/* Image Container - ensure no forced cropping */}
                        <div className="w-full bg-slate-100 flex items-center justify-center min-h-[300px] p-2">
                            <img 
                                src={currentImage.url} 
                                alt={currentImage.prompt}
                                className="max-w-full h-auto max-h-[80vh] object-contain shadow-sm rounded-lg"
                            />
                        </div>
                        
                        {/* Overlay Actions */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-end justify-end p-4 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
                            <button 
                                onClick={() => handleDownload(currentImage.url, `z-image-${Date.now()}.jpg`)}
                                className="bg-white text-slate-900 hover:text-indigo-600 font-medium px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 transform transition-transform hover:scale-105 active:scale-95"
                            >
                                <DownloadIcon className="w-4 h-4" />
                                {t.download}
                            </button>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                         <p className="text-sm text-slate-600 line-clamp-2">
                            <span className="font-semibold text-slate-900">{t.promptLabel}</span> {currentImage.prompt}
                        </p>
                    </div>
                </div>
            </section>
        )}

        {/* History Grid */}
        {history.length > 0 && (
            <section className="pt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-indigo-500" />
                        {t.recentGenerations}
                    </h2>
                    <button 
                        onClick={clearHistory}
                        className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors"
                    >
                        <TrashIcon className="w-3 h-3" />
                        {t.clearHistory}
                    </button>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {history.map((img, idx) => (
                        <div 
                            key={idx} 
                            onClick={() => setCurrentImage(img)}
                            className={`group relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all
                                ${currentImage === img ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-transparent hover:border-slate-300'}
                            `}
                        >
                            <img 
                                src={img.url} 
                                alt={img.prompt}
                                className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                                <p className="text-white text-[10px] line-clamp-2">{img.prompt}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        )}

      </main>
      
      <footer className="mt-12 text-center text-slate-400 text-sm">
        <p>{t.footer}</p>
      </footer>

      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-slate-800">{t.downloadModalTitle}</h4>
              <button onClick={() => setShowDownloadModal(false)} className="text-xs px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-md text-slate-600">{t.cancel}</button>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{t.baiduPan}</span>
                {DOWNLOAD_LINKS.baidu ? (
                  <a href={DOWNLOAD_LINKS.baidu} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">{t.download}</a>
                ) : (
                  <span className="text-xs text-slate-400">{t.linkPending}</span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{t.quarkPan}</span>
                {DOWNLOAD_LINKS.quark ? (
                  <a href={DOWNLOAD_LINKS.quark} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline">{t.download}</a>
                ) : (
                  <span className="text-xs text-slate-400">{t.linkPending}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
