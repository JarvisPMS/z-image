import React, { useState, useEffect } from 'react';
import { KeyIcon } from './Icons';

interface ApiKeyInputProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  labels: {
    placeholder: string;
    update: string;
    get: string;
    save: string;
    cancel: string;
  }
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, onApiKeyChange, labels }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [localKey, setLocalKey] = useState(apiKey);

  useEffect(() => {
    setLocalKey(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    onApiKeyChange(localKey);
    setIsVisible(false);
  };

  const hasKey = apiKey && apiKey.length > 5;

  if (!isVisible && hasKey) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="flex items-center gap-2 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm"
      >
        <KeyIcon className="w-3 h-3" />
        <span>{labels.update}</span>
      </button>
    );
  }

  return (
    <div className="w-full max-w-md bg-white p-4 rounded-lg border border-indigo-100 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200 relative z-50">
      <div className="flex flex-col gap-3">
        <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <KeyIcon className="w-4 h-4 text-indigo-500" />
          {labels.placeholder}
        </label>
        <input
          type="password"
          value={localKey}
          onChange={(e) => setLocalKey(e.target.value)}
          placeholder="sk-..."
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        <div className="flex items-center justify-between">
           <a 
            href="https://modelscope.cn/my/myaccesstoken" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs text-indigo-500 hover:underline"
          >
            {labels.get}
          </a>
          <div className="flex gap-2">
            {hasKey && (
               <button
               onClick={() => setIsVisible(false)}
               className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
             >
               {labels.cancel}
             </button>
            )}
            <button
              onClick={handleSave}
              disabled={!localKey.trim()}
              className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {labels.save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
