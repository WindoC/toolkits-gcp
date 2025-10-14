import React, { useState } from 'react';
import EncryptionService from '../services/encryptionService';

interface KeyManagementProps {
  onKeyUpdated?: () => void;
}

export const KeyManagement: React.FC<KeyManagementProps> = ({ onKeyUpdated }) => {
  const [showChangeKey, setShowChangeKey] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  
  const hasKey = EncryptionService.isAvailable();

  const handleChangeKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKey.trim()) return;

    setIsUpdating(true);
    try {
      // Hash the new key and store it
      const keyBytes = new TextEncoder().encode(newKey.trim());
      const keyBuffer = new ArrayBuffer(keyBytes.length);
      new Uint8Array(keyBuffer).set(keyBytes);
      const hashedKey = await crypto.subtle.digest('SHA-256', keyBuffer);
      const hashedKeyHex = Array.from(new Uint8Array(hashedKey))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      
      localStorage.setItem('aes_key_hash', hashedKeyHex);
      setNewKey('');
      setShowChangeKey(false);
      onKeyUpdated?.();
      
      // Show success message briefly
      const button = document.getElementById('key-updated-success');
      if (button) {
        button.style.display = 'block';
        setTimeout(() => {
          button.style.display = 'none';
        }, 3000);
      }
    } catch (error) {
      console.error('Failed to update encryption key:', error);
      alert('Failed to update encryption key. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveKey = () => {
    if (confirm('Are you sure you want to remove your encryption key? You will lose access to encrypted conversations.')) {
      localStorage.removeItem('aes_key_hash');
      onKeyUpdated?.();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
        Encryption Settings
      </h3>
      
      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              Encryption Status
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {hasKey ? 'Encryption is enabled' : 'Encryption is not configured'}
            </p>
          </div>
          <div className="flex items-center">
            {hasKey ? (
              <div className="flex items-center space-x-2">
                <div className="flex items-center">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-sm text-green-600 dark:text-green-400">Active</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                <span className="text-sm text-red-600 dark:text-red-400">Inactive</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {hasKey ? (
        <div className="space-y-3">
          <div className="flex space-x-3">
            <button
              onClick={() => setShowChangeKey(!showChangeKey)}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/30 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {showChangeKey ? 'Cancel' : 'Change Key'}
            </button>
            <button
              onClick={handleRemoveKey}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Remove Key
            </button>
          </div>
          
          <div id="key-updated-success" style={{ display: 'none' }} className="text-sm text-green-600 dark:text-green-400">
            ✓ Encryption key updated successfully
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Encryption is not configured. You will be prompted to set up an encryption key when you start chatting.
          </p>
        </div>
      )}

      {showChangeKey && (
        <form onSubmit={handleChangeKey} className="space-y-3 border-t pt-4">
          <div>
            <label htmlFor="new-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Encryption Key
            </label>
            <input
              id="new-key"
              type="password"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="Enter new encryption key..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={isUpdating}
              autoComplete="new-password"
            />
          </div>
          
          <button
            type="submit"
            disabled={!newKey.trim() || isUpdating}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating ? 'Updating...' : 'Update Key'}
          </button>
        </form>
      )}
    </div>
  );
};