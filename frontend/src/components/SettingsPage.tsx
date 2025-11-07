import React from 'react';
import { KeyManagement } from './KeyManagement';
import { useAuth } from '../contexts/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-[calc(100vh-3rem)] bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Chat-style header */}
      <header className="relative z-20 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
        <div className="flex items-center justify-between min-h-[48px] sm:min-h-[56px]">
          <div className="flex-1" />
          <h1 className="text-base md:text-lg font-medium text-gray-900 dark:text-gray-100 text-center">
            Settings
          </h1>
          <div className="flex-1 text-right">
            {user && (
              <span className="hidden sm:inline text-xs text-gray-600 dark:text-gray-400">{user.username}</span>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="px-2 sm:px-4 md:px-6 py-3 md:py-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <KeyManagement />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
