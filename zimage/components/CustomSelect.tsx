import React, { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from './Icons';

interface Option {
  value: string | number;
  label: React.ReactNode;
}

interface CustomSelectProps {
  value: string | number;
  onChange: (value: any) => void;
  options: Option[];
  className?: string;
  placeholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
  placeholder = 'Select...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string | number) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2
          bg-white border border-slate-200 rounded-lg 
          py-2 pl-3 pr-3 text-sm text-left
          shadow-sm transition-all duration-200
          hover:border-indigo-300 hover:shadow-md
          focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500
          ${isOpen ? 'border-indigo-500 ring-2 ring-indigo-500/20' : ''}
        `}
      >
        <span className={`truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDownIcon 
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-100 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <ul className="max-h-60 overflow-auto py-1">
            {options.map((option) => (
              <li key={String(option.value)}>
                <button
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`
                    w-full text-left px-3 py-2 text-sm transition-colors
                    flex items-center justify-between
                    ${option.value === value 
                      ? 'bg-indigo-50 text-indigo-700 font-medium' 
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <span className="truncate">{option.label}</span>
                  {option.value === value && (
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 flex-shrink-0 ml-2" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
