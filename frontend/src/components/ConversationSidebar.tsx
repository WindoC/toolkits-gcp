import React, { useState } from 'react';
import { ConversationSummary } from '../types';

interface ConversationSidebarProps {
  conversations: ConversationSummary[];
  currentConversationId?: string;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  onDeleteConversation: (conversationId: string) => void;
  onStarConversation: (conversationId: string, starred: boolean) => void;
  onBulkDeleteNonstarred: () => void;
  loading?: boolean;
}

export const ConversationSidebar: React.FC<ConversationSidebarProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewChat,
  onDeleteConversation,
  onStarConversation,
  onBulkDeleteNonstarred,
  loading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const starredConversations = conversations.filter(conv => conv.starred);
  const unstarredConversations = conversations.filter(conv => !conv.starred);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

  const ConversationItem: React.FC<{ conversation: ConversationSummary }> = ({ conversation }) => (
    <div
      className={`
        group flex items-center justify-between p-3 rounded-xl cursor-pointer
        hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200
        ${conversation.conversation_id === currentConversationId 
          ? 'bg-gray-200 dark:bg-gray-800 border-l-4 border-primary-500' 
          : ''
        }
      `}
      onClick={() => {
        onSelectConversation(conversation.conversation_id);
        // Close mobile menu when selecting a conversation
        if (window.innerWidth < 768) {
          setIsOpen(false);
        }
      }}
    >
      <div className="flex-1 min-w-0">
        <h4 className="text-gray-900 dark:text-gray-100 text-sm font-medium truncate">
          {conversation.title || 'Untitled Conversation'}
        </h4>
        <p className="text-gray-600 dark:text-gray-400 text-xs mt-1">{formatDate(conversation.last_updated)}</p>
        {conversation.preview && (
          <p className="text-gray-500 dark:text-gray-500 text-xs mt-1 truncate">{conversation.preview}</p>
        )}
      </div>
      
      {/* Always show star button if starred, otherwise show on hover */}
      <div className={`flex items-center space-x-1 transition-opacity ${
        conversation.starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      }`}>
        {/* Star button - always visible when starred */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStarConversation(conversation.conversation_id, !conversation.starred);
          }}
          className={`p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors ${
            conversation.starred ? 'opacity-100' : ''
          }`}
          title={conversation.starred ? 'Unstar' : 'Star'}
        >
          {conversation.starred ? (
            <svg className="w-4 h-4 text-yellow-500 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          )}
        </button>
        
        {/* Delete button - only show on hover */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDeleteConversation(conversation.conversation_id);
          }}
          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          title="Delete"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`md:hidden fixed top-4 left-4 z-[60] p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded-lg shadow-soft hover:bg-gray-50 dark:hover:bg-gray-700 transition-all ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-[55] w-[85vw] max-w-sm md:w-80
        bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            {/* Close button for mobile */}
            <div className="md:hidden flex justify-end mb-4">
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => {
                onNewChat();
                // Close mobile menu when starting new chat
                if (window.innerWidth < 768) {
                  setIsOpen(false);
                }
              }}
              className="w-full px-4 py-3 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white rounded-xl font-medium transition-all duration-200 shadow-soft hover:shadow-soft-lg"
            >
              <span className="flex items-center justify-center space-x-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>New Chat</span>
              </span>
            </button>
          </div>

          {/* Conversations */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loading ? (
              <div className="text-gray-600 dark:text-gray-400 text-center">Loading conversations...</div>
            ) : (
              <>
                {/* Starred Conversations */}
                {starredConversations.length > 0 && (
                  <div>
                    <h3 className="text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold mb-2">Starred</h3>
                    <div className="space-y-1">
                      {starredConversations.map(conversation => (
                        <ConversationItem key={conversation.conversation_id} conversation={conversation} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Conversations */}
                {unstarredConversations.length > 0 && (
                  <div>
                    <h3 className="text-gray-600 dark:text-gray-400 text-xs uppercase font-semibold mb-2">Recent</h3>
                    <div className="space-y-1">
                      {unstarredConversations.map(conversation => (
                        <ConversationItem key={conversation.conversation_id} conversation={conversation} />
                      ))}
                    </div>
                  </div>
                )}

                {conversations.length === 0 && (
                  <div className="text-gray-600 dark:text-gray-400 text-center text-sm">
                    No conversations yet. Start a new chat!
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 md:p-6 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="w-full px-4 py-4 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors min-h-[56px] flex items-center justify-center"
              disabled={unstarredConversations.length === 0}
            >
              <span className="flex items-center justify-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete All Non-starred</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Bulk delete confirmation modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl max-w-md mx-4 shadow-soft-lg animate-slide-down">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Confirm Bulk Delete</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete all non-starred conversations? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onBulkDeleteNonstarred();
                  setShowBulkDeleteConfirm(false);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};