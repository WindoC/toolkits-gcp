import React, { useState, useEffect, useRef } from 'react';
import { modelsCache, Model } from '../services/modelsCache';

interface ModelSelectorProps {
  selectedModel: string;
  onModelChange: (modelId: string) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModelInfo = availableModels.find(model => model.id === selectedModel) || availableModels[0];

  // Load models from cache on component mount
  useEffect(() => {
    const loadModels = async () => {
      // Check if models are already cached
      const cachedModels = modelsCache.getCachedModels();
      if (cachedModels) {
        // Use cached models immediately
        setAvailableModels(cachedModels);
        setLoading(false);
        setError(modelsCache.getError());
        
        // If selected model is not in the list, select the first one
        if (cachedModels.length > 0 && !cachedModels.find(m => m.id === selectedModel)) {
          onModelChange(cachedModels[0].id);
        }
        return;
      }

      // Models not cached yet, load them
      try {
        setLoading(true);
        setError(null);
        const models = await modelsCache.getModels();
        setAvailableModels(models);
        
        // If selected model is not in the list, select the first one
        if (models.length > 0 && !models.find(m => m.id === selectedModel)) {
          onModelChange(models[0].id);
        }
      } catch (err) {
        console.error('Failed to load models:', err);
        setError('Failed to load models');
      } finally {
        setLoading(false);
      }
    };

    loadModels();
  }, [selectedModel, onModelChange]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleModelSelect = (modelId: string) => {
    onModelChange(modelId);
    setIsOpen(false);
  };

  const handleRefreshModels = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setLoading(true);
      setError(null);
      const models = await modelsCache.refresh();
      setAvailableModels(models);
    } catch (err) {
      console.error('Failed to refresh models:', err);
      setError('Failed to refresh models');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className={`flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-w-[160px] justify-between ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={loading ? 'Loading models...' : error ? error : `${selectedModelInfo?.description} ${modelsCache.hasCachedModels() ? '(cached)' : ''}`}
      >
        <div className="flex items-center space-x-2">
          {loading ? (
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          ) : error ? (
            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
          ) : (
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          )}
          <span className="truncate">
            {loading ? 'Loading...' : error ? 'Error' : selectedModelInfo?.name || 'Select Model'}
          </span>
        </div>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && !loading && (
        <div className="absolute top-full left-0 mt-1 w-80 max-w-[90vw] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
          {/* Refresh button */}
          <div className="p-2 border-b border-gray-200 dark:border-gray-600">
            <button
              onClick={handleRefreshModels}
              disabled={loading}
              className="flex items-center space-x-2 w-full px-3 py-2 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Refresh Models {modelsCache.hasCachedModels() ? '(42 cached)' : ''}</span>
            </button>
          </div>
          
          {availableModels.map((model) => (
            <button
              key={model.id}
              onClick={() => handleModelSelect(model.id)}
              className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                selectedModel === model.id ? 'bg-blue-50 dark:bg-blue-950' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <div className={`w-2 h-2 rounded-full mt-2 ${
                  selectedModel === model.id ? 'bg-blue-500' : 'bg-green-500'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {model.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {model.description}
                  </div>
                </div>
                {selectedModel === model.id && (
                  <div className="text-blue-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}