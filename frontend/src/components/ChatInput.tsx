import React, { useState, useRef, useEffect } from 'react';

interface ChatInputProps {
  onSendMessage: (message: string, enableSearch?: boolean) => void;
  disabled?: boolean;
  placeholder?: string;
  shouldFocus?: boolean;
  onFocused?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ 
  onSendMessage, 
  disabled = false, 
  placeholder = "Type your message...",
  shouldFocus = false,
  onFocused
}) => {
  const [message, setMessage] = useState('');
  const [enableSearch, setEnableSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message.trim(), enableSearch);
      setMessage('');
      setEnableSearch(false); // Auto-reset after sending
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  useEffect(() => {
    if (shouldFocus && !disabled && textareaRef.current) {
      textareaRef.current.focus();
      onFocused?.();
    }
  }, [shouldFocus, disabled, onFocused]);

  return (
    <div className="relative z-30 border-t border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm p-2 sm:p-4 md:p-6 transition-colors duration-200">
      <form onSubmit={handleSubmit} className="max-w-full sm:max-w-2xl md:max-w-3xl mx-auto">
        <div className="flex items-end space-x-2 md:space-x-4">
          {/* Search Toggle Button */}
          <button
            type="button"
            onClick={() => setEnableSearch(!enableSearch)}
            disabled={disabled}
            className={`
              p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all duration-200 min-h-[44px] sm:min-h-[56px] flex items-center justify-center
              ${enableSearch
                ? 'bg-primary-500 text-white shadow-soft hover:bg-primary-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-primary-500
            `}
            title="Search the web for current information"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className="
                w-full px-3 sm:px-4 py-3 sm:py-4 pr-4 sm:pr-32 border border-gray-300 dark:border-gray-600 rounded-xl sm:rounded-2xl
                bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                placeholder-gray-500 dark:placeholder-gray-400
                focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed
                resize-none overflow-hidden min-h-[44px] sm:min-h-[56px] max-h-[150px] sm:max-h-[200px] shadow-soft
                transition-all duration-200
              "
              style={{ minHeight: '44px' }}
            />
            <div className="absolute right-4 bottom-4 text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
              {disabled ? 'Sending...' : 'Enter to send, Shift+Enter for new line'}
            </div>
          </div>
          
          <button
            type="submit"
            disabled={disabled || !message.trim()}
            className="
              px-3 sm:px-4 md:px-6 py-3 sm:py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl sm:rounded-2xl font-medium
              hover:from-primary-600 hover:to-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500
              disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed
              transition-all duration-200 shadow-soft hover:shadow-soft-lg
              min-h-[44px] sm:min-h-[56px] flex items-center justify-center
            "
          >
            {disabled ? (
              <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};