import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { ConversationSidebar } from './components/ConversationSidebar';
import { ThemeToggle } from './components/ThemeToggle';
import { EditableTitle } from './components/EditableTitle';
import { ModelSelector } from './components/ModelSelector';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NotesPage } from './components/NotesPage';
import { FilesPage } from './components/FilesPage';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { apiService } from './services/api';
import EncryptionService from './services/encryptionService';
import { AESKeyModal } from './components/AESKeyModal';
import { Message, ConversationSummary, SSEEvent } from './types';
import Portal from './components/Portal';
import SettingsPage from './components/SettingsPage';

function ChatInterface() {
  const { logout } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [currentConversation, setCurrentConversation] = useState<string | null>(null);
  const [currentConversationTitle, setCurrentConversationTitle] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [shouldFocusInput, setShouldFocusInput] = useState(false);
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('selectedModel') || 'gemini-2.5-flash';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyModalMessage, setKeyModalMessage] = useState('');
  const [keyChangeCounter, setKeyChangeCounter] = useState(0); // For triggering re-renders
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check for encryption key and prompt if needed
  const checkEncryptionKey = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (EncryptionService.isAvailable()) {
        resolve(true);
      } else {
        setKeyModalMessage('Enter your AES encryption key to secure your conversations:');
        setShowKeyModal(true);
        
        // Set up a one-time listener for when key is set
        const checkKey = () => {
          if (EncryptionService.isAvailable()) {
            setShowKeyModal(false);
            resolve(true);
          } else {
            setTimeout(checkKey, 100);
          }
        };
        checkKey();
      }
    });
  };

  const handleKeySubmit = async (key: string) => {
    try {
      await EncryptionService.setupEncryptionKey(key);
      setShowKeyModal(false);
      setKeyChangeCounter(prev => prev + 1); // Trigger re-render
    } catch (error) {
      console.error('Failed to setup encryption key:', error);
      alert('Failed to setup encryption key. Please try again.');
    }
  };

  const handleKeyCancel = () => {
    setShowKeyModal(false);
    // Optionally, you could prevent the user from proceeding without encryption
  };

  useEffect(scrollToBottom, [messages, streamingMessage]);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setIsLoading(true);
      const convs = await apiService.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const conversation = await apiService.getConversation(conversationId);
      setMessages(conversation.messages);
      setCurrentConversation(conversationId);
      setCurrentConversationTitle(conversation.title || null);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewChat = () => {
    setCurrentConversation(null);
    setCurrentConversationTitle(null);
    setMessages([]);
    setStreamingMessage('');
  };

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('selectedModel', modelId);
  };

  const sendMessage = async (messageText: string, enableSearch = false) => {
    if (isStreaming) return;

    // Check for encryption key first
    const hasKey = await checkEncryptionKey();
    if (!hasKey) return; // User cancelled key setup

    // Add user message to UI immediately
    const userMessage: Message = {
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingMessage('');

    // Close any existing EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    try {
      // Create chat stream
      const eventSource = await apiService.createChatStream(
        messageText, 
        currentConversation || undefined, 
        enableSearch,
        selectedModel
      );
      eventSourceRef.current = eventSource;

      let aiMessageContent = '';

      eventSource.onmessage = async (event) => {
        try {
          const data: SSEEvent = JSON.parse(event.data);

          switch (data.type) {
            case 'conversation_start':
              // New conversation started
              break;

            case 'chunk':
              if (data.content) {
                aiMessageContent += data.content;
                setStreamingMessage(aiMessageContent);
              }
              break;

            case 'encrypted_chunk':
              if (data.encrypted_data && EncryptionService.isAvailable()) {
                try {
                  const decryptedChunk = await EncryptionService.decryptData(data.encrypted_data);
                  if (decryptedChunk.content) {
                    aiMessageContent += decryptedChunk.content;
                    setStreamingMessage(aiMessageContent);
                  }
                } catch (error) {
                  console.error('Failed to decrypt chunk:', error);
                  // Stop streaming and prompt for new key
                  setIsStreaming(false);
                  setStreamingMessage('');
                  eventSource.close();
                  setKeyModalMessage('Decryption failed. Please enter your correct encryption key:');
                  setShowKeyModal(true);
                  return;
                }
              }
              break;

            case 'done':
              if (data.conversation_id) {
                const conversationId = data.conversation_id;
                setCurrentConversation(conversationId);
                // Load the conversation to get the generated title
                setTimeout(async () => {
                  try {
                    const conversation = await apiService.getConversation(conversationId);
                    setCurrentConversationTitle(conversation.title || null);
                  } catch (error) {
                    console.error('Failed to load conversation title:', error);
                  }
                }, 100);
              }

              // Add final AI message with grounding data
              const aiMessage: Message = {
                role: 'ai',
                content: aiMessageContent,
                references: data.references,
                search_queries: data.search_queries,
                grounding_supports: data.grounding_supports,
                url_context_urls: data.url_context_urls,
                grounded: data.grounded || false,
                created_at: new Date().toISOString(),
              };

              setMessages(prev => [...prev, aiMessage]);
              setStreamingMessage('');
              setIsStreaming(false);
              eventSource.close();

              // Focus input after AI response completes
              setShouldFocusInput(true);

              // Reload conversations to update sidebar
              loadConversations();
              break;

            case 'encrypted_done':
              if (data.encrypted_data && EncryptionService.isAvailable()) {
                try {
                  const decryptedData = await EncryptionService.decryptData(data.encrypted_data);
                  
                  if (decryptedData.conversation_id) {
                    const conversationId = decryptedData.conversation_id;
                    setCurrentConversation(conversationId);
                    // Load the conversation to get the generated title
                    setTimeout(async () => {
                      try {
                        const conversation = await apiService.getConversation(conversationId);
                        setCurrentConversationTitle(conversation.title || null);
                      } catch (error) {
                        console.error('Failed to load conversation title:', error);
                      }
                    }, 100);
                  }

                  // Add final AI message with grounding data
                  const aiMessage: Message = {
                    role: 'ai',
                    content: aiMessageContent,
                    references: decryptedData.references,
                    search_queries: decryptedData.search_queries,
                    grounding_supports: decryptedData.grounding_supports,
                    url_context_urls: decryptedData.url_context_urls,
                    grounded: decryptedData.grounded || false,
                    created_at: new Date().toISOString(),
                  };

                  setMessages(prev => [...prev, aiMessage]);
                  setStreamingMessage('');
                  setIsStreaming(false);
                  eventSource.close();

                  // Focus input after AI response completes
                  setShouldFocusInput(true);

                  // Reload conversations to update sidebar
                  loadConversations();
                } catch (error) {
                  console.error('Failed to decrypt final data:', error);
                  setIsStreaming(false);
                  setStreamingMessage('');
                  eventSource.close();
                  setKeyModalMessage('Decryption failed. Please enter your correct encryption key:');
                  setShowKeyModal(true);
                }
              }
              break;

            case 'error':
              console.error('SSE Error:', data.error);
              setIsStreaming(false);
              setStreamingMessage('');
              eventSource.close();
              break;
          }
        } catch (error) {
          console.error('Failed to parse SSE data:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        setIsStreaming(false);
        setStreamingMessage('');
        eventSource.close();
      };

    } catch (error) {
      console.error('Failed to send message:', error);
      setIsStreaming(false);
      setStreamingMessage('');
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await apiService.deleteConversation(conversationId);
      if (currentConversation === conversationId) {
        startNewChat();
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const starConversation = async (conversationId: string, starred: boolean) => {
    try {
      await apiService.starConversation(conversationId, starred);
      loadConversations();
    } catch (error) {
      console.error('Failed to star conversation:', error);
    }
  };

  const bulkDeleteNonstarred = async () => {
    try {
      await apiService.bulkDeleteNonstarred();
      if (currentConversation) {
        const currentConv = conversations.find(c => c.conversation_id === currentConversation);
        if (currentConv && !currentConv.starred) {
          startNewChat();
        }
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to bulk delete conversations:', error);
    }
  };

  const renameConversation = async (conversationId: string, title: string) => {
    try {
      await apiService.renameConversation(conversationId, title);
      if (currentConversation === conversationId) {
        setCurrentConversationTitle(title);
      }
      loadConversations();
    } catch (error) {
      console.error('Failed to rename conversation:', error);
    }
  };

  const copyFullConversation = async () => {
    try {
      const allMessages = [...messages];
      if (streamingMessage) {
        allMessages.push({
          role: 'ai',
          content: streamingMessage,
          created_at: new Date().toISOString(),
        });
      }

      const markdownContent = allMessages
        .map(msg => {
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          let messageContent = `**${role}:** ${msg.content}`;
          
          // Add references for AI messages with grounding
          if (msg.role === 'ai' && msg.references && msg.references.length > 0) {
            messageContent += '\n\n**References:**\n';
            msg.references.forEach(ref => {
              messageContent += `${ref.id}. [${ref.title}](${ref.url})\n`;
            });
          }
          
          // Add search queries if available
          if (msg.role === 'ai' && msg.search_queries && msg.search_queries.length > 0) {
            messageContent += '\n**Search Queries:** ' + msg.search_queries.join(', ');
          }
          
          // Add URL context if available
          if (msg.role === 'ai' && msg.url_context_urls && msg.url_context_urls.length > 0) {
            messageContent += '\n**URL Context:** ' + msg.url_context_urls.join('\n    ');
          }
          
          return messageContent;
        })
        .join('\n\n---\n\n');

      const fullContent = `# ${currentConversationTitle || 'Conversation'}\n\n${markdownContent}`;
      
      await navigator.clipboard.writeText(fullContent);
      
      // Show success feedback (could be enhanced with a toast notification)
      console.log('Full conversation copied to clipboard');
    } catch (err) {
      console.error('Failed to copy conversation: ', err);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      {/* Sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentConversationId={currentConversation || undefined}
        onSelectConversation={loadConversation}
        onNewChat={startNewChat}
        onDeleteConversation={deleteConversation}
        onStarConversation={starConversation}
        onBulkDeleteNonstarred={bulkDeleteNonstarred}
        loading={isLoading}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col md:ml-0">
        {/* Header */}
        <header className="relative z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-2 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 transition-colors duration-200">
          <div className="flex items-center justify-between min-h-[48px] sm:min-h-[56px]">
            {/* Left section: Model selector - hidden on very small screens */}
            <div className="hidden sm:flex items-center pl-12 md:pl-0">
              <ModelSelector selectedModel={selectedModel} onModelChange={handleModelChange} />
            </div>
            
            {/* Center: Title - takes more space on mobile */}
            <div className="flex-1 flex justify-center px-12 sm:px-4">
              <EditableTitle
                title={currentConversationTitle}
                onSave={(newTitle) => currentConversation && renameConversation(currentConversation, newTitle)}
                placeholder={currentConversation ? "Untitled Conversation" : "New Chat"}
                className="text-base md:text-lg font-medium text-gray-900 dark:text-gray-100 text-center truncate max-w-[200px] sm:max-w-none"
                disabled={!currentConversation || isStreaming}
              />
            </div>
            {/* Right section: Action buttons - simplified on mobile */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Copy button - hidden on small screens */}
              {messages.length > 0 && (
                <button
                  onClick={copyFullConversation}
                  className="hidden sm:flex p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Copy full conversation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              )}
              
              {/* Home (Portal) and Settings links */}
              <Link
                to="/"
                className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Home"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
                </svg>
              </Link>

              <Link
                to="/setting"
                className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Settings"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M11.0175 19C10.6601 19 10.3552 18.7347 10.297 18.373C10.2434 18.0804 10.038 17.8413 9.76171 17.75C9.53658 17.6707 9.31645 17.5772 9.10261 17.47C8.84815 17.3365 8.54289 17.3565 8.30701 17.522C8.02156 17.7325 7.62943 17.6999 7.38076 17.445L6.41356 16.453C6.15326 16.186 6.11944 15.7651 6.33361 15.458C6.49878 15.2105 6.52257 14.8914 6.39601 14.621C6.31262 14.4332 6.23906 14.2409 6.17566 14.045C6.08485 13.7363 5.8342 13.5051 5.52533 13.445C5.15287 13.384 4.8779 13.0559 4.87501 12.669V11.428C4.87303 10.9821 5.18705 10.6007 5.61601 10.528C5.94143 10.4645 6.21316 10.2359 6.33751 9.921C6.37456 9.83233 6.41356 9.74433 6.45451 9.657C6.61989 9.33044 6.59705 8.93711 6.39503 8.633C6.1424 8.27288 6.18119 7.77809 6.48668 7.464L7.19746 6.735C7.54802 6.37532 8.1009 6.32877 8.50396 6.625L8.52638 6.641C8.82735 6.84876 9.21033 6.88639 9.54428 6.741C9.90155 6.60911 10.1649 6.29424 10.2375 5.912L10.2473 5.878C10.3275 5.37197 10.7536 5.00021 11.2535 5H12.1115C12.6248 4.99976 13.0629 5.38057 13.1469 5.9L13.1625 5.97C13.2314 6.33617 13.4811 6.63922 13.8216 6.77C14.1498 6.91447 14.5272 6.87674 14.822 6.67L14.8707 6.634C15.2842 6.32834 15.8528 6.37535 16.2133 6.745L16.8675 7.417C17.1954 7.75516 17.2366 8.28693 16.965 8.674C16.7522 8.99752 16.7251 9.41325 16.8938 9.763L16.9358 9.863C17.0724 10.2045 17.3681 10.452 17.7216 10.521C18.1837 10.5983 18.5235 11.0069 18.525 11.487V12.6C18.5249 13.0234 18.2263 13.3846 17.8191 13.454C17.4842 13.5199 17.2114 13.7686 17.1083 14.102C17.0628 14.2353 17.0121 14.3687 16.9562 14.502C16.8261 14.795 16.855 15.1364 17.0323 15.402C17.2662 15.7358 17.2299 16.1943 16.9465 16.485L16.0388 17.417C15.7792 17.6832 15.3698 17.7175 15.0716 17.498C14.8226 17.3235 14.5001 17.3043 14.2331 17.448C14.0428 17.5447 13.8475 17.6305 13.6481 17.705C13.3692 17.8037 13.1636 18.0485 13.1099 18.346C13.053 18.7203 12.7401 18.9972 12.3708 19H11.0175Z"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M13.9747 12C13.9747 13.2885 12.9563 14.333 11.7 14.333C10.4437 14.333 9.42533 13.2885 9.42533 12C9.42533 10.7115 10.4437 9.66699 11.7 9.66699C12.9563 9.66699 13.9747 10.7115 13.9747 12Z"
                    stroke="currentColor"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              
              {/* Theme toggle - smaller on mobile */}
              <div className="scale-90 sm:scale-100">
                <ThemeToggle />
              </div>
              
              {/* Logout button - smaller on mobile */}
              <button
                onClick={logout}
                className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title="Logout"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-2 sm:px-4 md:px-6 py-3 md:py-4">
          <div className="space-y-4 md:space-y-6 w-full">
            {messages.length === 0 && !streamingMessage && (
              <div className="text-center text-gray-600 dark:text-gray-400 mt-8 md:mt-20">
                <div className="mb-6 md:mb-8">
                  <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-4 md:mb-6 bg-gradient-to-r from-primary-400 to-primary-600 rounded-2xl flex items-center justify-center shadow-soft">
                    <span className="text-xl md:text-2xl text-white">🤖</span>
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold mb-3 md:mb-4 text-gray-900 dark:text-gray-100">
                    Welcome to Toolkits
                  </h2>
                  <p className="text-base md:text-lg max-w-md mx-auto px-4">
                    Start a conversation with our AI assistant powered by Google Gemini.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 max-w-sm md:max-w-2xl mx-auto mt-6 md:mt-12 px-4 md:px-0">
                  <div className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 md:mb-2">💡 Ask Questions</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get answers to your questions on any topic
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 md:mb-2">✨ Generate Content</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Create stories, code, emails, and more
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 md:mb-2">🔍 Analyze Data</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get insights and explanations about complex topics
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-soft">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1.5 md:mb-2">🎯 Solve Problems</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Get step-by-step solutions and guidance
                    </p>
                  </div>
                  <div className="p-3 md:p-4 bg-blue-50 dark:bg-blue-950 rounded-xl border border-blue-200 dark:border-blue-800 shadow-soft col-span-full">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      🌐 NEW: Web Search Grounding
                    </h3>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Enable the search toggle to get answers grounded with real-time web search results and citations.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <ChatMessage key={index} message={message} />
            ))}

            {streamingMessage && (
              <ChatMessage
                message={{
                  role: 'ai',
                  content: streamingMessage,
                  created_at: new Date().toISOString(),
                }}
                isStreaming={true}
              />
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput
          onSendMessage={sendMessage}
          disabled={isStreaming}
          placeholder={isStreaming ? "AI is responding..." : "Type your message..."}
          shouldFocus={shouldFocusInput}
          onFocused={() => setShouldFocusInput(false)}
        />
      </div>

      {/* AES Key Modal */}
      <AESKeyModal
        isOpen={showKeyModal}
        onSubmit={handleKeySubmit}
        onCancel={handleKeyCancel}
        message={keyModalMessage}
      />
    </div>
  );
}

function AppShell() {
  const location = useLocation();
  const hideHeader = location.pathname.startsWith('/chat');

  return (
    <div className="h-screen flex flex-col">
      {!hideHeader && (
        <header className="sticky top-0 z-40 border-b border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-black backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-black">
          <div className="max-w-7xl mx-auto px-4">
            <div className="h-12 flex items-center justify-between">
              <nav className="flex items-center gap-1 text-sm">
                {/* Home icon */}
                <NavLink
                  to="/"
                  title="Home"
                  aria-label="Home"
                  className={({ isActive }) => [
                    'px-2.5 py-1.5 rounded-md transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  ].join(' ')}
                  end
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6" />
                  </svg>
                </NavLink>

                {/* Text links */}
                {[
                  { to: '/chat', label: 'Chat' },
                  { to: '/note', label: 'Notes' },
                  { to: '/file', label: 'Files' },
                  { to: '/setting', label: 'Settings' },
                ].map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) => [
                      'px-3 py-1.5 rounded-md transition-colors',
                      isActive
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                    ].join(' ')}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <div className="flex items-center">
                <ThemeToggle />
              </div>
            </div>
          </div>
        </header>
      )}
      <div className="flex-1 min-h-0">
        <Routes>
          <Route path="/" element={<Portal />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/note" element={<NotesPage />} />
          <Route path="/file" element={<FilesPage />} />
          <Route path="/setting" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <ProtectedRoute>
          <AppShell />
        </ProtectedRoute>
      </Router>
    </AuthProvider>
  );
}

export default App;
