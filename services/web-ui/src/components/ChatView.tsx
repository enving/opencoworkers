/**
 * ChatView.tsx - Simple Chat Interface (FEAT-CHAT)
 * 
 * A beautiful chat interface for direct agent interaction.
 * Features:
 * - Real-time streaming responses
 * - Conversation history
 * - Model selection
 * - Thinking process visualization
 * - Dynamic UI with smooth animations
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Send,
    Plus,
    Trash2,
    MessageSquare,
    Bot,
    User,
    Loader2,
    ChevronDown,
    Sparkles,
    Settings2,
    Brain,
    X,
    History,
    Zap
} from 'lucide-react';
import { clsx } from 'clsx';
import { chatApi, type ChatMessage, type ChatConversation } from '../api/chat';

// Markdown-like rendering for code blocks
function renderContent(content: string) {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const inlineCodeRegex = /`([^`]+)`/g;

    let result = content;

    // Replace code blocks
    result = result.replace(codeBlockRegex, (_, _lang, code) => {
        return `<pre class="bg-zinc-950 rounded-xl p-4 overflow-x-auto my-3 border border-zinc-800"><code class="text-sm text-emerald-400 font-mono">${escapeHtml(code.trim())}</code></pre>`;
    });

    // Replace inline code
    result = result.replace(inlineCodeRegex, '<code class="bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-pink-400 font-mono">$1</code>');

    // Replace newlines with <br> (but not inside <pre>)
    const parts = result.split(/(<pre[\s\S]*?<\/pre>)/);
    result = parts.map(part =>
        part.startsWith('<pre') ? part : part.replace(/\n/g, '<br>')
    ).join('');

    return result;
}

function escapeHtml(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function MessageBubble({ message, isStreaming }: { message: ChatMessage; isStreaming?: boolean }) {
    const isUser = message.role === 'user';
    const [showThinking, setShowThinking] = useState(false);

    return (
        <div className={clsx(
            'flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
            isUser ? 'flex-row-reverse' : 'flex-row'
        )}>
            {/* Avatar */}
            <div className={clsx(
                'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg',
                isUser
                    ? 'bg-gradient-to-br from-indigo-500 to-purple-600'
                    : 'bg-gradient-to-br from-emerald-500 to-teal-600'
            )}>
                {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
            </div>

            {/* Message content */}
            <div className={clsx(
                'max-w-[80%] rounded-2xl px-4 py-3 shadow-lg',
                isUser
                    ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-md'
                    : 'bg-zinc-800/80 text-zinc-100 rounded-bl-md border border-zinc-700/50'
            )}>
                {/* Thinking toggle for assistant */}
                {!isUser && message.thinking && (
                    <button
                        onClick={() => setShowThinking(!showThinking)}
                        className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 mb-2 transition-colors"
                    >
                        <Brain size={12} />
                        <span>{showThinking ? 'Hide' : 'Show'} thinking</span>
                        <ChevronDown size={12} className={clsx('transition-transform', showThinking && 'rotate-180')} />
                    </button>
                )}

                {/* Thinking content */}
                {showThinking && message.thinking && (
                    <div className="bg-zinc-900/60 rounded-lg p-3 mb-3 text-xs text-zinc-400 italic border border-zinc-700/30">
                        <div dangerouslySetInnerHTML={{ __html: renderContent(message.thinking) }} />
                    </div>
                )}

                {/* Message content */}
                <div
                    className={clsx('text-sm leading-relaxed', isUser && 'text-white')}
                    dangerouslySetInnerHTML={{ __html: renderContent(message.content) }}
                />

                {/* Streaming indicator */}
                {isStreaming && (
                    <span className="inline-flex items-center gap-1 mt-1">
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse delay-75" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse delay-150" />
                    </span>
                )}

                {/* Timestamp & tokens */}
                <div className={clsx(
                    'flex items-center gap-2 mt-2 text-[10px]',
                    isUser ? 'text-indigo-200' : 'text-zinc-500'
                )}>
                    <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
                    {message.tokens && (
                        <span className="flex items-center gap-1">
                            <Zap size={10} />
                            {message.tokens.completion} tokens
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function ConversationSidebar({
    conversations,
    activeId,
    onSelect,
    onCreate,
    onDelete,
    isOpen,
    onClose
}: {
    conversations: ChatConversation[];
    activeId: string | null;
    onSelect: (id: string) => void;
    onCreate: () => void;
    onDelete: (id: string) => void;
    isOpen: boolean;
    onClose: () => void;
}) {
    return (
        <div className={clsx(
            'absolute inset-y-0 left-0 w-72 bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-800 transform transition-transform duration-300 z-20',
            isOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <h3 className="font-semibold text-zinc-100 flex items-center gap-2">
                    <History size={18} />
                    Conversations
                </h3>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
                    <X size={18} />
                </button>
            </div>

            <div className="p-3">
                <button
                    onClick={onCreate}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-indigo-500/20"
                >
                    <Plus size={18} />
                    New Chat
                </button>
            </div>

            <div className="overflow-y-auto flex-1 px-3 space-y-1">
                {conversations.map(conv => (
                    <div
                        key={conv.id}
                        className={clsx(
                            'group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
                            activeId === conv.id
                                ? 'bg-zinc-800 text-zinc-100'
                                : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                        )}
                        onClick={() => onSelect(conv.id)}
                    >
                        <MessageSquare size={16} className="flex-shrink-0" />
                        <span className="flex-1 truncate text-sm">{conv.title}</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete(conv.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/20 hover:text-red-400 transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                ))}

                {conversations.length === 0 && (
                    <div className="text-center py-8 text-zinc-500 text-sm">
                        <MessageSquare size={32} className="mx-auto mb-2 opacity-50" />
                        No conversations yet
                    </div>
                )}
            </div>
        </div>
    );
}

export function ChatView() {
    const queryClient = useQueryClient();
    const [inputValue, setInputValue] = useState('');
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamingContent, setStreamingContent] = useState('');
    const [thinkingContent, setThinkingContent] = useState('');
    const [showSidebar, setShowSidebar] = useState(false);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Fetch conversations
    const { data: conversations = [] } = useQuery({
        queryKey: ['chat-conversations'],
        queryFn: () => chatApi.listConversations(),
    });

    // Fetch chat config (available models)
    const { data: chatConfig } = useQuery({
        queryKey: ['chat-config'],
        queryFn: () => chatApi.getConfig(),
    });

    // Set default model when config loads
    useEffect(() => {
        if (chatConfig?.model && !selectedModel) {
            setSelectedModel(chatConfig.model);
        }
    }, [chatConfig, selectedModel]);

    // Auto-scroll to bottom with improved behavior
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    
    const scrollToBottom = useCallback(() => {
        // Use requestAnimationFrame to ensure this runs after DOM updates
        requestAnimationFrame(() => {
            if (messagesContainerRef.current) {
                // Directly scroll the container to bottom
                messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
        });
    }, []);

    useEffect(() => {
        scrollToBottom();
        // Add a small delay to ensure scrolling works with content that loads asynchronously
        const timer = setTimeout(() => {
            scrollToBottom();
        }, 100);
        return () => clearTimeout(timer);
    }, [messages, streamingContent, scrollToBottom]);

    // Load conversation messages when selected
    useEffect(() => {
        if (activeConversationId) {
            chatApi.getConversation(activeConversationId)
                .then(conv => setMessages(conv.messages))
                .catch(console.error);
        } else {
            setMessages([]);
        }
    }, [activeConversationId]);

    // Create conversation mutation
    const createConversation = useMutation({
        mutationFn: () => chatApi.createConversation('New Chat', selectedModel),
        onSuccess: (conv) => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            setActiveConversationId(conv.id);
            setMessages([]);
        },
    });

    // Delete conversation mutation
    const deleteConversation = useMutation({
        mutationFn: (id: string) => chatApi.deleteConversation(id),
        onSuccess: (_, deletedId) => {
            queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
            if (activeConversationId === deletedId) {
                setActiveConversationId(null);
                setMessages([]);
            }
        },
    });

    // Send message
    const handleSend = async () => {
        const content = inputValue.trim();
        if (!content || isStreaming) return;

        // Add user message immediately
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsStreaming(true);
        setStreamingContent('');
        setThinkingContent('');

        try {
            await chatApi.sendMessage(
                content,
                {
                    conversationId: activeConversationId || undefined,
                    model: selectedModel,
                    stream: true
                },
                {
                    onToken: (token) => {
                        setStreamingContent(prev => prev + token);
                    },
                    onThinking: (thinking) => {
                        setThinkingContent(prev => prev + thinking);
                    },
                    onComplete: (message) => {
                        setMessages(prev => [...prev, message]);
                        setIsStreaming(false);
                        setStreamingContent('');
                        setThinkingContent('');

                        // Create conversation if none exists
                        if (!activeConversationId) {
                            chatApi.createConversation(content.slice(0, 50), selectedModel)
                                .then(conv => {
                                    setActiveConversationId(conv.id);
                                    queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
                                });
                        }
                    },
                    onError: (error) => {
                        console.error('Chat error:', error);
                        setIsStreaming(false);
                        // Add error message
                        setMessages(prev => [...prev, {
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: `❌ Error: ${error.message}`,
                            timestamp: new Date().toISOString(),
                        }]);
                    },
                }
            );
        } catch (error) {
            console.error('Send error:', error);
            setIsStreaming(false);
        }
    };

    // Handle textarea resize and submit
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }
    }, [inputValue]);

    return (
        <div className="relative h-[calc(100vh-180px)] bg-zinc-900/30 rounded-3xl border border-zinc-800 overflow-hidden">
            {/* Sidebar */}
            <ConversationSidebar
                conversations={conversations}
                activeId={activeConversationId}
                onSelect={(id) => {
                    setActiveConversationId(id);
                    setShowSidebar(false);
                }}
                onCreate={() => {
                    createConversation.mutate();
                    setShowSidebar(false);
                }}
                onDelete={(id) => deleteConversation.mutate(id)}
                isOpen={showSidebar}
                onClose={() => setShowSidebar(false)}
            />

            {/* Overlay when sidebar is open */}
            {showSidebar && (
                <div
                    className="absolute inset-0 bg-black/40 z-10 animate-in fade-in duration-200"
                    onClick={() => setShowSidebar(false)}
                />
            )}

            {/* Header */}
            <div className="absolute top-0 inset-x-0 flex items-center justify-between px-6 py-4 bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-800 z-10">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSidebar(true)}
                        className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                        <History size={20} />
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <div>
                            <h2 className="font-semibold text-zinc-100">AI Assistant</h2>
                            <p className="text-xs text-zinc-500">Powered by OpenCoworkers</p>
                        </div>
                    </div>
                </div>

                {/* Model selector */}
                <div className="flex items-center gap-3">
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {chatConfig?.availableModels?.map(model => (
                            <option key={model} value={model}>{model}</option>
                        ))}
                        {!chatConfig?.availableModels?.length && (
                            <option value="">No models configured</option>
                        )}
                    </select>
                    <button className="p-2 rounded-xl hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors">
                        <Settings2 size={20} />
                    </button>
                </div>
            </div>

            {/* Messages area */}
            <div ref={messagesContainerRef} className="absolute top-[72px] bottom-[88px] inset-x-0 overflow-y-auto px-6 py-4 space-y-4">
                {messages.length === 0 && !isStreaming && (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="w-20 h-20 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center mb-6 border border-indigo-500/20">
                            <Bot size={40} className="text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-100 mb-2">Start a Conversation</h3>
                        <p className="text-zinc-500 max-w-md">
                            Chat directly with your AI agent. Ask questions, get help with code, or discuss your projects.
                        </p>
                        <div className="flex flex-wrap gap-2 mt-6 justify-center">
                            {['Explain my codebase', 'Help me debug', 'Write a test', 'Review my PR'].map(prompt => (
                                <button
                                    key={prompt}
                                    onClick={() => setInputValue(prompt)}
                                    className="px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/50 rounded-xl text-sm text-zinc-300 hover:text-zinc-100 transition-all"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {messages.map(message => (
                    <MessageBubble key={message.id} message={message} />
                ))}

                {/* Streaming message */}
                {isStreaming && streamingContent && (
                    <MessageBubble
                        message={{
                            id: 'streaming',
                            role: 'assistant',
                            content: streamingContent,
                            timestamp: new Date().toISOString(),
                            thinking: thinkingContent || undefined,
                        }}
                        isStreaming
                    />
                )}

                {/* Loading indicator */}
                {isStreaming && !streamingContent && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                            <Bot size={16} className="text-white" />
                        </div>
                        <div className="bg-zinc-800/80 rounded-2xl rounded-bl-md px-4 py-3 border border-zinc-700/50">
                            <div className="flex items-center gap-2 text-zinc-400 text-sm">
                                <Loader2 size={16} className="animate-spin" />
                                Thinking...
                            </div>
                        </div>
                    </div>
                )}

                <div />
            </div>

            {/* Input area */}
            <div className="absolute bottom-0 inset-x-0 p-4 bg-zinc-900/80 backdrop-blur-xl border-t border-zinc-800">
                <div className="flex items-end gap-3">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type your message... (Shift+Enter for new line)"
                        rows={1}
                        className="flex-1 bg-zinc-800/50 border border-zinc-700 rounded-2xl px-4 py-3 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none min-h-[48px] max-h-[200px]"
                        disabled={isStreaming}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim() || isStreaming}
                        className={clsx(
                            'p-3 rounded-2xl transition-all shadow-lg',
                            inputValue.trim() && !isStreaming
                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/20'
                                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                        )}
                    >
                        {isStreaming ? (
                            <Loader2 size={20} className="animate-spin" />
                        ) : (
                            <Send size={20} />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ChatView;
