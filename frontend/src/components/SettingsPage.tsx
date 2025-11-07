import React from 'react';
import { KeyManagement } from './KeyManagement';
import { useAuth } from '../contexts/AuthContext';

export const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 py-10 px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
            {user && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Signed in as {user.username}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
          >
            Sign out
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
          <KeyManagement />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

