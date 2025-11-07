import React from 'react';
import { Link } from 'react-router-dom';

export const Portal: React.FC = () => {
  const cards = [
    { title: 'Chat', description: 'Converse with AI', to: '/chat' },
    { title: 'Notes', description: 'Write and manage encrypted notes', to: '/note' },
    { title: 'Files', description: 'Upload and browse files', to: '/file' },
    { title: 'Settings', description: 'Manage encryption and preferences', to: '/setting' },
  ];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900 py-10 px-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Portal</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">Choose a tool to get started.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(card => (
            <Link
              key={card.to}
              to={card.to}
              className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{card.title}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">{card.description}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Portal;

