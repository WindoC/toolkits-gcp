import React, { useState, useEffect, useRef } from 'react';
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
              
              {/* Encryption button - smaller on mobile */}
              <button
                onClick={() => {
                  setKeyModalMessage('Update your encryption key:');
                  setShowKeyModal(true);
                }}
                className="p-1.5 sm:p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={EncryptionService.isAvailable() || keyChangeCounter >= 0 ? 'Update encryption key' : 'Setup encryption key'}
              >
                <div className="relative">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  {(!EncryptionService.isAvailable() || keyChangeCounter < 0) && (
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></div>
                  )}
                </div>
              </button>
              
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
                    Welcome to Chat-AI
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

function App() {
  const [view, setView] = React.useState<'chat'|'notes'|'files'>(() => (localStorage.getItem('ui_view') as any) || 'chat');
  const setAndPersist = (v: 'chat'|'notes'|'files') => { setView(v); localStorage.setItem('ui_view', v); };
  return (
    <AuthProvider>
      <ProtectedRoute>
        <div className="h-screen flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-4 py-2">
            <div className="flex items-center gap-2">
              <button className={`px-3 py-1 rounded ${view==='chat'?'bg-blue-600 text-white':'bg-gray-100 dark:bg-gray-800'}`} onClick={()=>setAndPersist('chat')}>Chat</button>
              <button className={`px-3 py-1 rounded ${view==='notes'?'bg-blue-600 text-white':'bg-gray-100 dark:bg-gray-800'}`} onClick={()=>setAndPersist('notes')}>Notes</button>
              <button className={`px-3 py-1 rounded ${view==='files'?'bg-blue-600 text-white':'bg-gray-100 dark:bg-gray-800'}`} onClick={()=>setAndPersist('files')}>Files</button>
            </div>
          </div>
          <div className="flex-1 min-h-0">
            {view==='chat' && <ChatInterface />}
            {view==='notes' && <NotesPage />}
            {view==='files' && <FilesPage />}
          </div>
        </div>
      </ProtectedRoute>
    </AuthProvider>
  );
}

export default App;
