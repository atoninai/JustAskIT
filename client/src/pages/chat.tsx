import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Bot, User, Send, Trash2, ArrowDown, Moon, Sun, Menu, Plus, X, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";
import type { Message, Conversation } from "@shared/schema";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { nanoid } from "nanoid";

function getSessionId(): string {
  let sessionId = localStorage.getItem("sessionId");
  if (!sessionId) {
    sessionId = nanoid();
    localStorage.setItem("sessionId", sessionId);
  }
  return sessionId;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showTosDialog, setShowTosDialog] = useState(true);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const sessionId = getSessionId();

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    scrollToBottom(false);
  }, [messages]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;
    const minHeight = 60;
    const maxHeight = 200;

    textarea.style.height = `${Math.min(Math.max(scrollHeight, minHeight), maxHeight)}px`;
  }, [input]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({
      behavior: smooth ? "smooth" : "auto",
    });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShowScrollButton(!isNearBottom && messages.length > 0);
  };

  const loadConversations = async () => {
    try {
      const response = await fetch(`/api/conversations/${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error("Error loading conversations:", error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`);
      if (response.ok) {
        const data = await response.json();
        const loadedMessages: Message[] = data.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(loadedMessages);
        setCurrentConversationId(conversationId);
        setShowSidebar(false);
      }
    } catch (error) {
      console.error("Error loading conversation:", error);
    }
  };

  const createNewConversation = async (firstMessage: string) => {
    try {
      const title = firstMessage.slice(0, 50) + (firstMessage.length > 50 ? "..." : "");
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, title }),
      });
      if (response.ok) {
        const conversation = await response.json();
        setCurrentConversationId(conversation.id);
        loadConversations();
        return conversation.id;
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    }
    return null;
  };

  const saveMessage = async (conversationId: string, role: string, content: string) => {
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, role, content }),
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await fetch(`/api/conversations/${conversationId}`, {
        method: "DELETE",
      });
      loadConversations();
      if (currentConversationId === conversationId) {
        setMessages([]);
        setCurrentConversationId(null);
      }
    } catch (error) {
      console.error("Error deleting conversation:", error);
    }
  };

  const handleAcceptTos = () => {
    setTosAccepted(true);
    setShowTosDialog(false);
    toast({
      title: "Terms Accepted",
      description: "You can now use Just Ask It.",
    });
  };

  const handleDeclineTos = () => {
    setShowTosDialog(false);
    toast({
      title: "Terms Declined",
      description: "You must accept the Terms of Service to use this application.",
      variant: "destructive",
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading || !tosAccepted) return;

    const userMessage: Message = {
      id: nanoid(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    let conversationId = currentConversationId;
    if (!conversationId) {
      conversationId = await createNewConversation(userMessage.content);
    }

    if (conversationId) {
      await saveMessage(conversationId, "user", userMessage.content);
    }

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          conversationHistory: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.rateLimited) {
          throw new Error("Server is busy. Please try again later.");
        }
        throw new Error("Failed to get response from AI");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage: Message = {
        id: nanoid(),
        role: "assistant",
        content: "",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  assistantMessage.content += parsed.content;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessage.id
                        ? { ...m, content: assistantMessage.content }
                        : m
                    )
                  );
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e);
              }
            }
          }
        }

        if (conversationId && assistantMessage.content) {
          await saveMessage(conversationId, "assistant", assistantMessage.content);
          loadConversations();
        }
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowClearDialog(false);
    toast({
      title: "Chat cleared",
      description: "Started a new conversation.",
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const sampleQuestions = [
    "Explain quantum computing",
    "Write a Python function to sort a list",
    "Plan a 3-day trip to Tokyo",
    "What are the benefits of meditation?",
  ];

  const handleSampleClick = (question: string) => {
    setInput(question);
    textareaRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!tosAccepted && !showTosDialog) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-4">
        <img src="/image.png" alt="Logo" className="h-20 w-20 mb-4 object-contain" />
        <h2 className="text-2xl font-semibold mb-2 text-foreground">
          Terms Required
        </h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          You must accept the Terms of Service to use Just Ask It.
        </p>
        <Button onClick={() => setShowTosDialog(true)}>
          Review Terms of Service
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <div
        className={`${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transition-transform duration-300 flex flex-col`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Conversations</h2>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setShowSidebar(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="p-2">
          <Button
            onClick={() => {
              setMessages([]);
              setCurrentConversationId(null);
              setShowSidebar(false);
            }}
            className="w-full justify-start gap-2"
            variant="outline"
          >
            <Plus className="h-4 w-4" />
            New Conversation
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-1 pb-4">
            {conversations.map((conv) => (
              <div key={conv.id} className="group relative">
                <Button
                  onClick={() => loadConversation(conv.id)}
                  variant={currentConversationId === conv.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left h-auto py-2 px-3"
                >
                  <MessageSquare className="h-4 w-4 mr-2 flex-shrink-0" />
                  <span className="truncate text-sm">{conv.title}</span>
                </Button>
                <Button
                  onClick={() => deleteConversation(conv.id)}
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-10 h-16 border-b bg-card/95 backdrop-blur border-border">
          <div className="container mx-auto h-full px-3 sm:px-4 flex items-center justify-between max-w-4xl gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden flex-shrink-0"
                onClick={() => setShowSidebar(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <img src="/image.png" alt="Logo" className="h-10 w-10 flex-shrink-0 object-contain" />
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                Just Ask It
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
                className="h-9 w-9"
              >
                {theme === "light" ? (
                  <Moon className="h-4 w-4" />
                ) : (
                  <Sun className="h-4 w-4" />
                )}
              </Button>
              {messages.length > 0 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearDialog(true)}
                    className="hidden sm:flex"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowClearDialog(true)}
                    className="sm:hidden h-9 w-9"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto scroll-smooth"
        >
          <div className="container mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <div className="mb-6">
                  <img src="/image.png" alt="Logo" className="h-20 w-20 object-contain opacity-80" />
                </div>
                <h2 className="text-2xl font-semibold mb-2 text-foreground">
                  Welcome to Just Ask It
                </h2>
                <p className="text-muted-foreground mb-6 sm:mb-8 text-center px-4">
                  Ask me anything and I'll help you find answers
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-2xl px-4">
                  {sampleQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => handleSampleClick(question)}
                      className="px-3 sm:px-4 py-2 rounded-full bg-muted hover-elevate active-elevate-2 text-xs sm:text-sm text-foreground transition-colors min-h-[36px]"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {message.role === "assistant" && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Bot className="h-5 w-5 text-primary" />
                        </div>
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] md:max-w-2xl lg:max-w-3xl ${
                        message.role === "user" ? "ml-auto" : "mr-auto"
                      }`}
                    >
                      <div
                        className={`p-3 md:p-4 ${
                          message.role === "user"
                            ? "bg-primary text-primary-foreground rounded-2xl rounded-br-sm"
                            : "bg-muted text-foreground rounded-2xl rounded-bl-sm"
                        }`}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none text-base prose-p:my-2 prose-pre:my-2 prose-ul:my-2 prose-ol:my-2">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-base whitespace-pre-wrap break-words font-normal">
                            {message.content}
                          </p>
                        )}
                      </div>
                      <div
                        className={`text-xs text-muted-foreground mt-1 ${
                          message.role === "user" ? "text-right" : "text-left"
                        }`}
                      >
                        {formatTime(message.timestamp)}
                      </div>
                    </div>
                    {message.role === "user" && (
                      <div className="flex-shrink-0 mt-1">
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <User className="h-5 w-5 text-secondary-foreground" />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3 justify-start">
                    <div className="flex-shrink-0 mt-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <Bot className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                    <div className="max-w-[85%] md:max-w-2xl lg:max-w-3xl">
                      <div className="p-3 md:p-4 bg-muted text-foreground rounded-2xl rounded-bl-sm">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-foreground/60 rounded-full animate-pulse" />
                          <span className="w-2 h-2 bg-foreground/60 rounded-full animate-pulse [animation-delay:0.2s]" />
                          <span className="w-2 h-2 bg-foreground/60 rounded-full animate-pulse [animation-delay:0.4s]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Scroll to Bottom Button */}
        {showScrollButton && (
          <button
            onClick={() => scrollToBottom()}
            className="fixed bottom-24 right-4 md:right-8 w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-lg hover-elevate active-elevate-2 flex items-center justify-center z-20 transition-opacity"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="h-5 w-5" />
          </button>
        )}

        {/* Input Area */}
        <div className="sticky bottom-0 border-t bg-card/95 backdrop-blur border-border">
          <div className="container mx-auto max-w-4xl p-3 sm:p-4">
            <div className="flex gap-2 items-end">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={tosAccepted ? "Ask me anything..." : "Accept Terms of Service to use this app"}
                className="min-h-[60px] max-h-[200px] resize-none rounded-2xl text-base flex-1 bg-background"
                rows={3}
                disabled={isLoading || !tosAccepted}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !tosAccepted}
                size="icon"
                className="h-10 w-10 rounded-xl flex-shrink-0"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar Overlay for Mobile */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Clear Chat Confirmation Dialog */}
      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent className="rounded-3xl max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start a new conversation. Your current conversation will be saved in history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearChat}>
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Terms of Service Dialog */}
      <AlertDialog open={showTosDialog} onOpenChange={setShowTosDialog}>
        <AlertDialogContent className="rounded-3xl max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">Terms of Service</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Please read and accept these terms to use Just Ask It
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="overflow-y-auto flex-1 pr-4 my-4">
            <div className="space-y-4 text-sm text-foreground">
              <section>
                <h3 className="font-semibold text-base mb-2">1. Acceptance of Terms</h3>
                <p className="text-muted-foreground">
                  By accessing and using Just Ask It, you acknowledge that you have read, understood,
                  and agree to be bound by these Terms of Service. If you do not agree to these terms,
                  you may not use this application.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">2. AI-Generated Content Disclaimer</h3>
                <p className="text-muted-foreground mb-2">
                  Just Ask It uses an uncensored artificial intelligence model. You acknowledge and agree that:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>The AI may generate content that is inaccurate, offensive, harmful, or inappropriate</li>
                  <li>The AI responses do not represent the views or opinions of the service provider</li>
                  <li>You use the AI-generated content entirely at your own risk</li>
                  <li>The service provider makes no warranties about the accuracy, reliability, or appropriateness of any AI responses</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">3. No Liability</h3>
                <p className="text-muted-foreground mb-2">
                  The owner and operator of Just Ask It shall not be held liable for:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-4">
                  <li>Any content generated by the AI system</li>
                  <li>Any actions taken based on AI-generated responses</li>
                  <li>Any damages, losses, or harm resulting from use of this service</li>
                  <li>Any offensive, illegal, or harmful content produced by the AI</li>
                  <li>Any decisions made based on information provided by the AI</li>
                </ul>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">4. User Responsibility</h3>
                <p className="text-muted-foreground">
                  You are solely responsible for how you use this service and any AI-generated content.
                  You agree to verify any important information independently and not to rely solely on
                  AI responses for critical decisions. You will not hold the service provider responsible
                  for any consequences arising from your use of this application.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">5. No Professional Advice</h3>
                <p className="text-muted-foreground">
                  Just Ask It does not provide professional advice of any kind, including but not limited to
                  legal, medical, financial, or therapeutic advice. Any information provided by the AI should
                  not be considered professional advice.
                </p>
              </section>

              <section>
                <h3 className="font-semibold text-base mb-2">6. Service Provided "As Is"</h3>
                <p className="text-muted-foreground">
                  This service is provided on an "as is" and "as available" basis without any warranties
                  of any kind, either express or implied. The service provider disclaims all warranties,
                  including but not limited to merchantability, fitness for a particular purpose, and
                  non-infringement.
                </p>
              </section>
            </div>
          </div>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={handleDeclineTos}>
              Decline
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleAcceptTos}>
              I Accept the Terms of Service
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
