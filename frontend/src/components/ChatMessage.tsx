import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { Message } from '../types';
import { References } from './References';

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, isStreaming = false }) => {
  const isUser = message.role === 'user';
  const [copySuccess, setCopySuccess] = useState(false);

  const copyToClipboard = async () => {
    try {
      let markdownContent = isUser 
        ? `**User:** ${message.content}`
        : `**Assistant:** ${message.content}`;
      
      // Add references for AI messages with grounding
      if (!isUser && message.references && message.references.length > 0) {
        markdownContent += '\n\n**References:**\n';
        message.references.forEach(ref => {
          markdownContent += `${ref.id}. [${ref.title}](${ref.url})\n`;
        });
      }
      
      // Add search queries if available
      if (!isUser && message.search_queries && message.search_queries.length > 0) {
        markdownContent += '\n**Search Queries:** ' + message.search_queries.join(', ');
      }
      
      // Add URL context if available
      if (!isUser && message.url_context_urls && message.url_context_urls.length > 0) {
        markdownContent += '\n**URL Context:** ' + message.url_context_urls.join('\n    ');
      }
      
      await navigator.clipboard.writeText(markdownContent);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  return (
    <div className={`group flex w-full mb-6`}>
      <div className="max-w-full sm:max-w-2xl md:max-w-3xl w-full mx-auto px-2 sm:px-4">
        <div
          className={`
            relative px-5 py-4 rounded-2xl shadow-soft transition-all duration-200
            ${isUser 
              ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-primary-500/20 ml-auto max-w-fit' 
              : message.grounded 
                ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border border-blue-200 dark:border-blue-800 text-gray-900 dark:text-gray-100 mr-auto max-w-full'
                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 mr-auto max-w-full'
            }
            ${isStreaming ? 'animate-pulse' : ''}
          `}
        >
        {isUser ? (
          <p className="whitespace-pre-wrap">{message.content}</p>
        ) : (
          <>
            {/* Grounding badge */}
            {message.grounded && (
              <div className="flex items-center mb-3 pb-2 border-b border-blue-200 dark:border-blue-800">
                {message.url_context_urls && message.url_context_urls.length > 0 ? (
                  <>
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      URL context response ({message.url_context_urls.length} URL{message.url_context_urls.length > 1 ? 's' : ''})
                    </span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                      Web-grounded response
                    </span>
                  </>
                )}
              </div>
            )}
            
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Style inline citations
                p({ children }) {
                  if (typeof children === 'string') {
                    // Convert citation numbers to styled spans
                    const parts = children.split(/(\[\d+\])/);
                    return (
                      <p>
                        {parts.map((part, index) => {
                          if (/^\[\d+\]$/.test(part)) {
                            return (
                              <span 
                                key={index}
                                className="inline-block text-xs bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 px-1 py-0.5 rounded mx-0.5 font-medium"
                              >
                                {part}
                              </span>
                            );
                          }
                          return part;
                        })}
                      </p>
                    );
                  }
                  return <p>{children}</p>;
                },
                code({ node, inline, className, children, ...props }: any) {
                  const match = /language-(\w+)/.exec(className || '');
                  return !inline && match ? (
                    <SyntaxHighlighter
                      style={vscDarkPlus}
                      language={match[1]}
                      PreTag="div"
                      className="rounded-md"
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={`${className} bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-sm`} {...props}>
                      {children}
                    </code>
                  );
                },
                pre({ children }) {
                  return <div className="overflow-x-auto">{children}</div>;
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-4">
                      {children}
                    </blockquote>
                  );
                },
                table({ children }) {
                  return (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return <thead className="bg-gray-50 dark:bg-gray-800">{children}</thead>;
                },
                th({ children }) {
                  return (
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                      {children}
                    </th>
                  );
                },
                td({ children }) {
                  return (
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-b border-gray-100 dark:border-gray-800">
                      {children}
                    </td>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
            
            {/* References */}
            {message.references && message.references.length > 0 && (
              <References references={message.references} />
            )}
          </div>
          </>
        )}
        
        {isStreaming && !isUser && (
          <div className="mt-3">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
        )}
        
        {/* Copy button */}
        {!isStreaming && (
          <button
            onClick={copyToClipboard}
            className={`
              absolute -top-2 ${isUser ? '-left-2' : '-right-2'} 
              opacity-0 group-hover:opacity-100 transition-opacity duration-200
              p-2 rounded-full shadow-soft hover:shadow-soft-lg
              ${isUser 
                ? 'bg-white text-primary-600 hover:bg-gray-50' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }
            `}
            title="Copy message"
          >
            {copySuccess ? (
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </button>
        )}
        </div>
      </div>
    </div>
  );
};