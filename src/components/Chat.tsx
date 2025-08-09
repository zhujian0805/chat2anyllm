import React, { useState, useEffect, useRef, useMemo, useContext } from 'react';
import { Message, ModelInfo, SessionSummary, RoleDef } from '../types';
import { ChatMessage } from './ChatMessage';
import { ModelSelector } from './ModelSelector';
import { createChatAPI } from '../utils/chatAPIProxy';
import { useTheme } from '../contexts/ThemeContext';
import { getLiteLLMModel } from '../utils/env';
import { AuthContext } from '../contexts/AuthContext';
import './Chat.css';
import { SessionsSidebar } from './SessionsSidebar';
import { listRoles, createRole, updateRole, deleteRole } from '../utils/rolesAPI';
import { listSessions, createSession, deleteSession, getSessionMessages, streamSessionChat } from '../utils/sessionsAPI';

export const Chat: React.FC = () => {
  // Replace localStorage-based messages with DB-backed session messages
  const [messages, setMessages] = useState<Message[]>([]);
  const authContext = useContext(AuthContext);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  // Slash command UI state
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<
    Array<
      | { kind: 'command'; id: 'clear' | 'models' | 'model' | 'model:plan-mode' | 'model:plan-mode-off' | 'roles' | 'role' | 'clear_role' | 'help'; title: string; subtitle?: string; run: () => void }
      | { kind: 'model'; model: ModelInfo; title: string; subtitle?: string; run: () => void }
      | { kind: 'role'; role: RoleDef; title: string; subtitle?: string; run: () => void }
    >
  >([]);
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(
    getLiteLLMModel()
  );
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  // Plan mode state
  const [planMode, setPlanMode] = useState(false);
  const [planningModel, setPlanningModel] = useState<string>('');
  const [answeringModel, setAnsweringModel] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const { theme, toggleTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [roles, setRoles] = useState<RoleDef[]>([]);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<RoleDef | null>(null);
  const [editingRoleText, setEditingRoleText] = useState('');
  const [savingRole, setSavingRole] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleInstructions, setNewRoleInstructions] = useState('');

  const chatAPI = useMemo(() => createChatAPI(), []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Auto-resize the input textarea to fit content up to a max height
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    // On desktop, keep fixed height to align with buttons
    if (window.innerWidth >= 769) {
      el.style.height = '44px';
      return;
    }
    // Base min height in px (match CSS mobile); grow up to 60vh or 600px
    const min = 44;
    const max = Math.min(Math.floor(window.innerHeight * 0.6), 600);
    el.style.height = 'auto';
    const desired = Math.min(el.scrollHeight, max);
    if (desired > el.clientHeight || el.clientHeight > desired + 4 || el.clientHeight < min) {
      el.style.height = Math.max(desired, min) + 'px';
    }
  };

  useEffect(() => {
    autoResize();
  }, [inputMessage]);

  // Initialize sessions and ensure an active one
  useEffect(() => {
    const init = async () => {
      try {
        const s = await listSessions();
        setSessions(s);
        if (s.length > 0) {
          setActiveSessionId(s[0].id);
        } else {
          const ns = await createSession('New Chat');
          setSessions([ns]);
          setActiveSessionId(ns.id);
        }
        // Load roles
        try {
          const rs = await listRoles();
          setRoles(rs);
        } catch (e) { /* ignore */ }
      } catch (e) {
        console.error('Failed to load sessions', e);
      }
    };
    init();
  }, []);

  // When active session changes, load its messages
  useEffect(() => {
    const load = async () => {
      if (!activeSessionId) return;
      try {
        const msgs = await getSessionMessages(activeSessionId);
        setMessages(msgs);
      } catch (e) {
        console.error('Failed to load messages', e);
        setMessages([]);
      }
    };
    load();
  }, [activeSessionId]);

  // Load models on component mount (existing code preserved)
  useEffect(() => {
    const loadModels = async () => {
      setModelsLoading(true);
      setModelsError(null);
      
      try {
        const modelList = await chatAPI.getModels();
        setModels(modelList);
        
        // Set default model if not already selected or if current selection is not in the list
        if (modelList.length > 0) {
          const currentModelExists = modelList.some(m => m.id === selectedModel);
          if (!currentModelExists) {
            const defaultModel = getLiteLLMModel();
            const modelExists = modelList.some(m => m.id === defaultModel);
            setSelectedModel(modelExists ? defaultModel : modelList[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        setModelsError('Using fallback models - LiteLLM server not available');
        // Keep the current selected model as fallback
      } finally {
        setModelsLoading(false);
      }
    };

    loadModels();
  }, [chatAPI]);

  // --- Slash commands: compute suggestions when typing starts with '/' ---
  useEffect(() => {
    const v = inputMessage;
    const trimmed = v.trimStart();
    if (!trimmed.startsWith('/')) {
      setSuggestionsOpen(false);
      setSuggestions([]);
      setActiveSuggestion(0);
      return;
    }

    // Parse command token and query
    const [cmdTokenRaw, ...rest] = trimmed.split(/\s+/);
    const cmdToken = cmdTokenRaw.toLowerCase();
    const query = rest.join(' ');

    // Base commands
    const commands = [
      {
        id: 'clear' as const,
        slash: '/clear',
        title: '/clear',
        subtitle: 'Clear chat',
        run: () => {
          clearChat();
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      },
      {
        id: 'models' as const,
        slash: '/models',
        title: '/models',
        subtitle: 'Show available models',
        run: () => {
          const list = models.length
            ? models
                .map((m, i) => `${i + 1}. ${m.id}${m.litellm_provider ? ` (${m.litellm_provider})` : ''}${m.id === selectedModel ? ' (current)' : ''}`)
                .join('\n')
            : 'No models available.';
          const assistantMessage: Message = {
            id: (Date.now() + 2).toString(),
            role: 'assistant',
            content: `Available models:\n${list}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      },
      {
        id: 'model' as const,
        slash: '/model',
        title: '/model',
        subtitle: 'Select a model: /model <name|id>',
        run: () => {
          // If query exists, try to set model; otherwise keep suggestions open
          const q = query.toLowerCase().trim();
          if (!q) return; // let the dropdown show models
          const picked =
            models.find(m => m.id.toLowerCase() === q) ||
            models.find(m => (m.id.toLowerCase().startsWith(q)));
          if (picked) {
            setSelectedModel(picked.id);
            const assistantMessage: Message = {
              id: (Date.now() + 3).toString(),
              role: 'assistant',
              content: `Model set to: ${picked.id}${picked.litellm_provider ? ` (${picked.litellm_provider})` : ''}`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setInputMessage('');
            setSuggestionsOpen(false);
          }
        }
      },
      {
        id: 'model:plan-mode' as const,
        slash: '/model:plan-mode',
        title: '/model:plan-mode',
  subtitle: 'Enable plan mode (first model plans, second executes): /model:plan-mode <planning_model> <answering_model>',
        run: () => {
          // Enable plan mode and set the two models
          setPlanMode(true);
          const cmdParts = inputMessage.trim().split(/\s+/);
          const modelArgs = cmdParts.slice(1); // Remove the command itself
          if (modelArgs.length >= 2) {
            const planningModelId = modelArgs[0];
            const answeringModelId = modelArgs.slice(1).join(' ');
            
            // Validate models exist
            const planningModelExists = models.find(m => m.id === planningModelId);
            const answeringModelExists = models.find(m => m.id === answeringModelId);
            
            if (planningModelExists && answeringModelExists) {
              setPlanningModel(planningModelId);
              setAnsweringModel(answeringModelId);
              const assistantMessage: Message = {
                id: (Date.now() + 4).toString(),
                role: 'assistant',
                content: `Plan mode enabled:\n- Planning model: ${planningModelId}${planningModelExists.litellm_provider ? ` (${planningModelExists.litellm_provider})` : ''}\n- Answering model: ${answeringModelId}${answeringModelExists.litellm_provider ? ` (${answeringModelExists.litellm_provider})` : ''}`,
                timestamp: new Date()
              };
              setMessages(prev => [...prev, assistantMessage]);
            } else {
              const assistantMessage: Message = {
                id: (Date.now() + 4).toString(),
                role: 'assistant',
                content: 'Error: One or both models not found. Please check available models with /models',
                timestamp: new Date()
              };
              setMessages(prev => [...prev, assistantMessage]);
            }
          } else {
            const assistantMessage: Message = {
              id: (Date.now() + 4).toString(),
              role: 'assistant',
              content: 'Usage: /model:plan-mode <planning_model> <answering_model>\nExample: /model:plan-mode gpt-4 claude-3',
              timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      },
      {
        id: 'model:plan-mode-off' as const,
        slash: '/model:plan-mode-off',
        title: '/model:plan-mode-off',
        subtitle: 'Disable plan mode',
        run: () => {
          // Disable plan mode
          setPlanMode(false);
          setPlanningModel('');
          setAnsweringModel('');
          const assistantMessage: Message = {
            id: (Date.now() + 4).toString(),
            role: 'assistant',
            content: 'Plan mode disabled. Returning to normal mode.',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      },
      {
        id: 'roles' as const,
        slash: '/roles',
        title: '/roles',
        subtitle: 'Show available roles',
        run: () => {
          const list = roles.length
            ? roles
                .sort((a,b)=>a.name.localeCompare(b.name))
                .map((r, i) => `${i + 1}. ${r.name}${r.id === activeRoleId ? ' (active)' : ''}`)
                .join('\n')
            : 'No roles available.';
          const assistantMessage: Message = {
            id: (Date.now() + 5).toString(),
            role: 'assistant',
            content: `Available roles:\n${list}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      },
      {
        id: 'role' as const,
        slash: '/role',
        title: '/role',
        subtitle: 'Select a role: /role <name>',
        run: () => {
          const q = query.toLowerCase().trim();
          if (!q) return; // let dropdown show roles
          const picked =
            roles.find(r => r.name.toLowerCase() === q) ||
            roles.find(r => r.name.toLowerCase().startsWith(q));
          if (picked) {
            setActiveRoleId(picked.id);
            const assistantMessage: Message = {
              id: (Date.now() + 6).toString(),
              role: 'assistant',
              content: `Role set to: ${picked.name}`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, assistantMessage]);
            setInputMessage('');
            setSuggestionsOpen(false);
          }
        }
      },
      {
        id: 'clear_role' as const,
        slash: '/clear_role',
        title: '/clear_role',
        subtitle: 'Clear active role',
        run: () => {
          setActiveRoleId(null);
          const assistantMessage: Message = {
            id: (Date.now() + 7).toString(),
            role: 'assistant',
            content: 'Active role cleared',
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      },
      {
        id: 'help' as const,
        slash: '/help',
        title: '/help',
        subtitle: 'Show available commands',
        run: () => {
          const helpText = `Available commands:
• /clear - Clear chat
• /models - Show available models
• /model <name|id> - Select a model
• /model:plan-mode <planning_model> <answering_model> - Enable plan mode (first model plans, second executes)
• /model:plan-mode-off - Disable plan mode
• /roles - Show available roles
• /role <name> - Select a role
• /clear_role - Clear active role
• /help - Show this help message`;
          const assistantMessage: Message = {
            id: (Date.now() + 8).toString(),
            role: 'assistant',
            content: helpText,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      }
    ];

    const baseMatches = commands
      .filter(c => c.slash.startsWith(cmdToken))
      .map(c => ({ kind: 'command' as const, id: c.id, title: c.title, subtitle: c.subtitle || '', run: c.run }));

  // If '/model' with or without partial, show filtered models
    let modelItems: Array<{ kind: 'model'; model: ModelInfo; title: string; subtitle?: string; run: () => void }> = [];
    const isModelCmd = '/model' === cmdToken || '/model'.startsWith(cmdToken);
    const hasModelPrefix = /^\/model\b/i.test(trimmed);
    if (isModelCmd && hasModelPrefix) {
      const q = query.toLowerCase().trim();
      const filtered = q
        ? models.filter(m => m.id.toLowerCase().includes(q))
        : models;
      modelItems = filtered.slice(0, 25).map(m => ({
        kind: 'model' as const,
        model: m,
        title: m.id,
        subtitle: m.id === selectedModel ? 'current' : m.litellm_provider,
        run: () => {
          setSelectedModel(m.id);
          const assistantMessage: Message = {
            id: (Date.now() + 4).toString(),
            role: 'assistant',
            content: `Model set to: ${m.id}${m.litellm_provider ? ` (${m.litellm_provider})` : ''}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      }));
    }

    // If '/role' show filtered roles
    let roleItems: Array<{ kind: 'role'; role: RoleDef; title: string; subtitle?: string; run: () => void }> = [];
    const isRoleCmd = '/role' === cmdToken || '/role'.startsWith(cmdToken);
    const hasRolePrefix = /^\/role\b/i.test(trimmed);
    if (isRoleCmd && hasRolePrefix) {
      const q = query.toLowerCase().trim();
      const filtered = q ? roles.filter(r => r.name.toLowerCase().includes(q)) : roles;
      roleItems = filtered.slice(0,25).map(r => ({
        kind: 'role' as const,
        role: r,
        title: r.name,
        subtitle: r.id === activeRoleId ? 'active' : undefined,
        run: () => {
          setActiveRoleId(r.id);
          const assistantMessage: Message = {
            id: (Date.now() + 7).toString(),
            role: 'assistant',
            content: `Role set to: ${r.name}`,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, assistantMessage]);
          setInputMessage('');
          setSuggestionsOpen(false);
        }
      }));
    }

    // For plain '/' show all commands
    let finalItems: Array<
      | { kind: 'command'; id: 'clear' | 'models' | 'model' | 'model:plan-mode' | 'model:plan-mode-off' | 'roles' | 'role' | 'clear_role' | 'help'; title: string; subtitle?: string; run: () => void }
      | { kind: 'model'; model: ModelInfo; title: string; subtitle?: string; run: () => void }
      | { kind: 'role'; role: RoleDef; title: string; subtitle?: string; run: () => void }
    > = cmdToken === '/'
      ? commands.map(c => ({ kind: 'command' as const, id: c.id as 'clear' | 'models' | 'model' | 'model:plan-mode' | 'model:plan-mode-off' | 'roles' | 'role' | 'clear_role' | 'help', title: c.title, subtitle: c.subtitle || '', run: c.run }))
      : baseMatches;

    if (modelItems.length) {
      finalItems = [...modelItems, ...finalItems.filter(i => i.kind === 'command')];
    }
    if (roleItems.length) {
      finalItems = [...roleItems, ...finalItems.filter(i => i.kind === 'command')];
    }
    
    // Handle plan-mode command with model suggestions
    let planModeItems: Array<{ kind: 'command'; id: 'model:plan-mode'; title: string; subtitle?: string; run: () => void }> = [];
    const isPlanModeCmd = '/model:plan-mode' === cmdToken || '/model:plan-mode'.startsWith(cmdToken);
    const hasPlanModePrefix = /^\/model:plan-mode\b/i.test(trimmed);
    if (isPlanModeCmd && hasPlanModePrefix) {
      // For plan-mode, show model suggestions for both planning and answering models
      const parts = query.trim().split(/\s+/);
      if (parts.length === 1) {
        // First model selection - show all models
        const firstModel = parts[0].toLowerCase();
        const filtered = firstModel 
          ? models.filter(m => m.id.toLowerCase().includes(firstModel))
          : models;
        planModeItems = filtered.slice(0, 10).map(m => ({
          kind: 'command' as const,
          id: 'model:plan-mode',
          title: `/model:plan-mode ${m.id}`,
          subtitle: `Select ${m.id} as planning model`,
          run: () => {
            setInputMessage(`/model:plan-mode ${m.id} `);
            setSuggestionsOpen(false);
          }
        }));
      } else if (parts.length >= 2) {
        // Second model selection - show all models for answering
        const secondModelQuery = parts[parts.length - 1].toLowerCase();
        const filtered = secondModelQuery 
          ? models.filter(m => m.id.toLowerCase().includes(secondModelQuery))
          : models;
        planModeItems = filtered.slice(0, 10).map(m => ({
          kind: 'command' as const,
          id: 'model:plan-mode',
          title: `/model:plan-mode ${parts.slice(0, parts.length - 1).join(' ')} ${m.id}`,
          subtitle: `Select ${m.id} as answering model`,
          run: () => {
            const fullCommand = `/model:plan-mode ${parts.slice(0, parts.length - 1).join(' ')} ${m.id}`;
            setInputMessage(fullCommand);
            setSuggestionsOpen(false);
          }
        }));
      }
    }
    
    if (planModeItems.length) {
      finalItems = [...planModeItems, ...finalItems.filter(i => i.kind === 'command')];
    }

    setSuggestions(finalItems);
    setSuggestionsOpen(finalItems.length > 0);
    setActiveSuggestion(0);
  }, [inputMessage, models, selectedModel, roles, activeRoleId, planMode, planningModel, answeringModel]);

  // Execute '/model:plan-mode <planning> <answering>' immediately when fully typed
  const runPlanModeCommandIfComplete = (raw: string): boolean => {
    const trimmed = raw.trim();
    if (!/^\/model:plan-mode(\s|$)/i.test(trimmed)) return false;
    const parts = trimmed.split(/\s+/);
    // ['/model:plan-mode', plan, ...answerParts]
    if (parts.length < 3) return false;

    const planningModelId = parts[1];
    const answeringModelId = parts.slice(2).join(' ');

    // Enable plan mode and set models
    setPlanMode(true);

    // Validate against loaded models if available; otherwise still set and inform
    const planningModelExists = models.find(m => m.id === planningModelId);
    const answeringModelExists = models.find(m => m.id === answeringModelId);

    if (planningModelExists && answeringModelExists) {
      setPlanningModel(planningModelId);
      setAnsweringModel(answeringModelId);
      const assistantMessage: Message = {
        id: (Date.now() + 4).toString(),
        role: 'assistant',
        content: `Plan mode enabled:\n- Planning model: ${planningModelId}${planningModelExists.litellm_provider ? ` (${planningModelExists.litellm_provider})` : ''}\n- Answering model: ${answeringModelId}${answeringModelExists.litellm_provider ? ` (${answeringModelExists.litellm_provider})` : ''}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } else {
      const assistantMessage: Message = {
        id: (Date.now() + 4).toString(),
        role: 'assistant',
        content: 'Error: One or both models not found. Please check available models with /models',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    }

    // Clear input and close suggestions
    setInputMessage('');
    setSuggestionsOpen(false);
    return true;
  };

  const handleSendMessage = async () => {
    const trimmed = inputMessage.trim();
    if (!trimmed || isLoading) return;

    // If it's a slash command, execute the currently highlighted or best match
    if (trimmed.startsWith('/')) {
      // Fast-path: if plan-mode is fully specified, execute immediately (avoid picking a suggestion that only edits text)
      if (runPlanModeCommandIfComplete(trimmed)) return;
      // if suggestion list open, run selected; else try best match
      if (suggestionsOpen && suggestions.length) {
        suggestions[activeSuggestion]?.run();
        return;
      }
      const [cmdTokenRaw, ...rest] = trimmed.split(/\s+/);
      const cmdToken = cmdTokenRaw.toLowerCase();
      const best = suggestions.find(s => s.kind === 'command' && (`/${(s as any).id}` as string).startsWith(cmdToken));
      if (best) {
        best.run();
        return;
      }
      // Fallback: if '/model <query>' and a model appears in suggestions, pick first
      const modelCandidate = suggestions.find(s => s.kind === 'model');
      if (modelCandidate) {
        modelCandidate.run();
        return;
      }
      const roleCandidate = suggestions.find(s => s.kind === 'role');
      if (roleCandidate) {
        roleCandidate.run();
        return;
      }
      // Unknown slash: fall through and send as text
    }
    
    // Use selected model or fallback
    const modelToUse = selectedModel || getLiteLLMModel();

    if (editingMessage) {
      // If we're editing a message, update the existing message and remove all subsequent messages
      const editedMessageIndex = messages.findIndex(msg => msg.id === editingMessage.id);
      if (editedMessageIndex !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[editedMessageIndex] = {
          ...editingMessage,
          content: inputMessage.trim()
        };
        
        // Remove all messages after the edited message
        const messagesToSend = updatedMessages.slice(0, editedMessageIndex + 1);
        setMessages(messagesToSend);
        
        // Clear editing state
        setEditingMessage(null);
        setInputMessage('');
        
        // Send the updated message
        setIsLoading(true);
        setConnectionError(null);

        // Create a streaming assistant message
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true
        };

        setMessages(prev => [...prev, assistantMessage]);

        try {
          await chatAPI.sendMessageStream(
            messagesToSend,
            modelToUse,
            // On chunk received
            (chunk: string) => {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content: msg.content + chunk }
                    : msg
                )
              );
            },
            // On completion
            () => {
              setMessages(prev => 
                prev.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, isStreaming: false }
                    : msg
                )
              );
              setIsLoading(false);
            },
            // On error
            (error: Error) => {
              setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
              // Remove the empty streaming message
              setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
              setIsLoading(false);
              console.error('Streaming error:', error);
            }
          );
        } catch (error) {
          setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
          setIsLoading(false);
          console.error('Error:', error);
        }
      }
      return;
    }

  const userMessageContent = inputMessage.trim();
  const activeRole = roles.find(r => r.id === activeRoleId);
  
  // Handle plan mode if enabled
  if (planMode && planningModel && answeringModel) {
    // Step 1: Send user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setConnectionError(null);

    // Step 2: Create a streaming assistant message for planning
    const planningMessageId = (Date.now() + 1).toString();
    const planningMessage: Message = {
      id: planningMessageId,
      role: 'assistant',
      content: 'Plan:\n\n',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, planningMessage]);

    try {
      if (!activeSessionId) throw new Error('No active session');
      
      // First, get the plan from the planning model
      let planContent = '';
      const planningPrefix = activeRole
        ? `[[ROLE:${activeRole.name}]]\n${activeRole.instructions}\n---\n`
        : '';
      await streamSessionChat(
        activeSessionId,
        planningModel,
        `${planningPrefix}Create a concise, actionable plan as a numbered checklist only. Rules:\n- Use 1., 2., 3., ...\n- One short, specific action per step\n- No intro or outro text\n\nTask: ${userMessageContent}`,
        (chunk: string) => {
          planContent += chunk;
          setMessages(prev => prev.map(m => m.id === planningMessageId ? { ...m, content: m.content + chunk } : m));
        },
        async () => {
          // Update the planning message to indicate it's complete
          setMessages(prev => prev.map(m => m.id === planningMessageId ? { ...m, isStreaming: false } : m));
          
          // Step 3: Create a streaming assistant message for answering based on the plan
          const answeringMessageId = (Date.now() + 2).toString();
          const answeringMessage: Message = {
            id: answeringMessageId,
            role: 'assistant',
            content: 'Implementation:\n\n',
            timestamp: new Date(),
            isStreaming: true
          };

          setMessages(prev => [...prev, answeringMessage]);
          
          // Now use the answering model to execute the plan
          const implementationPrefix = activeRole
            ? `[[ROLE:${activeRole.name}]]\n${activeRole.instructions}\n---\n`
            : '';
          await streamSessionChat(
            activeSessionId,
            answeringModel,
            `${implementationPrefix}Follow the numbered steps in the plan below and produce a concrete implementation.\n\nRules:\n- Do NOT restate or re-list the plan.\n- Provide only actionable output: commands, file contents, API calls, or code.\n- Use fenced code blocks with correct language tags (bash, sh, json, yaml, python, ts, etc.).\n- When creating/editing files, include the file path before the code block.\n- Assume Linux with bash for shell commands.\n- Keep brief explanations only where needed.\n- End with a short "Verify" section the user can run.\n\nOriginal question: ${userMessageContent}\n\nPlan (for you to follow, do not echo):\n${planContent}`,
            (chunk: string) => {
              setMessages(prev => prev.map(m => m.id === answeringMessageId ? { ...m, content: m.content + chunk } : m));
            },
            () => {
              setMessages(prev => prev.map(m => m.id === answeringMessageId ? { ...m, isStreaming: false } : m));
              setIsLoading(false);
              // refresh sessions order/title in background
              listSessions().then(setSessions).catch(() => {});
            },
            (error: Error) => {
              setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
              setMessages(prev => prev.filter(msg => msg.id !== answeringMessageId));
              setIsLoading(false);
              console.error('Streaming error:', error);
            }
          );
        },
        (error: Error) => {
          setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
          setMessages(prev => prev.filter(msg => msg.id !== planningMessageId));
          setIsLoading(false);
          console.error('Planning streaming error:', error);
        }
      );
    } catch (error) {
      setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
      setIsLoading(false);
      console.error('Error:', error);
    }
  } else {
    // Normal message sending logic
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setConnectionError(null);

    // Create a streaming assistant message
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      if (!activeSessionId) throw new Error('No active session');
      // Prepend a system message with role instructions when active
      const combined = activeRole ? `[[ROLE:${activeRole.name}]]\n${activeRole.instructions}\n---\n${userMessageContent}` : userMessageContent;
      await streamSessionChat(
        activeSessionId,
        modelToUse,
        combined,
        (chunk: string) => {
          setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, content: m.content + chunk } : m));
        },
        () => {
          setMessages(prev => prev.map(m => m.id === assistantMessageId ? { ...m, isStreaming: false } : m));
          setIsLoading(false);
          // refresh sessions order/title in background
          listSessions().then(setSessions).catch(() => {});
        },
        (error: Error) => {
          setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
          setIsLoading(false);
          console.error('Streaming error:', error);
        }
      );
    } catch (error) {
      setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
      setIsLoading(false);
      console.error('Error:', error);
    }
  }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Navigate suggestions when open
    if (suggestionsOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        setActiveSuggestion((i) => (i + 1) % Math.max(suggestions.length, 1));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setSuggestionsOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = async () => {
    try {
      const ns = await createSession('New Chat');
      setSessions(prev => [ns, ...prev]);
      setActiveSessionId(ns.id);
      setMessages([]);
      setConnectionError(null);
      setEditingMessage(null);
    } catch (e) {
      console.error('Failed to create new session', e);
    }
  };

  const handleEditMessage = (message: Message, newContent: string) => {
    // If the content hasn't changed, just exit edit mode
    if (message.content === newContent) {
      return;
    }

    // Find the message index
    const messageIndex = messages.findIndex(msg => msg.id === message.id);
    if (messageIndex !== -1) {
      const updatedMessages = [...messages];
      updatedMessages[messageIndex] = {
        ...message,
        content: newContent
      };
      
      // Remove all messages after the edited message
      const messagesToSend = updatedMessages.slice(0, messageIndex + 1);
      setMessages(messagesToSend);
      
      // Use selected model or fallback
      const modelToUse = selectedModel || getLiteLLMModel();
      
      // Send the updated message
      setIsLoading(true);
      setConnectionError(null);

      // Create a streaming assistant message
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isStreaming: true
      };

      setMessages(prev => [...prev, assistantMessage]);

      try {
        chatAPI.sendMessageStream(
          messagesToSend,
          modelToUse,
          // On chunk received
          (chunk: string) => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, content: msg.content + chunk }
                  : msg
              )
            );
          },
          // On completion
          () => {
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? { ...msg, isStreaming: false }
                  : msg
              )
            );
            setIsLoading(false);
          },
          // On error
          (error: Error) => {
            setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
            // Remove the empty streaming message
            setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
            setIsLoading(false);
            console.error('Streaming error:', error);
          }
        );
      } catch (error) {
        setConnectionError('Failed to connect to LiteLLM. Please check your configuration.');
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
        setIsLoading(false);
        console.error('Error:', error);
      }
    }
  };

  const refreshModels = async () => {
    setModelsLoading(true);
    setModelsError(null);
    
    try {
      const modelList = await chatAPI.getModels();
      setModels(modelList);
    } catch (error) {
      setModelsError('Failed to load models');
    } finally {
      setModelsLoading(false);
    }
  };

  // Role editing helpers
  const startEditRole = (role: RoleDef) => {
    setEditingRole(role);
    setEditingRoleText(role.instructions);
    setNewRoleName(role.name);
  setCreatingRole(false);
  };

  const cancelEditRole = () => {
    setEditingRole(null);
    setEditingRoleText('');
  setCreatingRole(false);
  setNewRoleName('');
  setNewRoleInstructions('');
  };

  const saveRoleEdits = async () => {
    if (!editingRole) return;
    const newName = newRoleName.trim();
    const newInstructions = editingRoleText.trim();
    if (newName === editingRole.name && newInstructions === editingRole.instructions) { 
      cancelEditRole(); 
      return; 
    }
    try {
      setSavingRole(true);
      const updates: Partial<Pick<RoleDef, 'name' | 'instructions'>> = {};
      if (newName !== editingRole.name) updates.name = newName;
      if (newInstructions !== editingRole.instructions) updates.instructions = newInstructions;
      
      const updated = await updateRole(editingRole.id, updates);
      setRoles(prev => prev.map(r => r.id === updated.id ? updated : r));
      // if active role was edited ensure activeRoleId unchanged
      setEditingRole(null);
      setEditingRoleText('');
      setNewRoleName('');
    } catch (e) {
      alert('Failed to update role');
    } finally {
      setSavingRole(false);
    }
  };

  const startCreateRole = () => {
    setCreatingRole(true);
    setEditingRole(null);
    setNewRoleName('');
    setNewRoleInstructions('');
  };

  const saveNewRole = async () => {
    const name = newRoleName.trim();
    const instructions = newRoleInstructions.trim();
    if (!name || !instructions) return;
    try {
      setSavingRole(true);
      const r = await createRole(name, instructions);
      setRoles(prev => [...prev, r].sort((a,b)=>a.name.localeCompare(b.name)));
      setCreatingRole(false);
      setNewRoleName('');
      setNewRoleInstructions('');
    } catch (e) {
      alert('Failed to create role');
    } finally {
      setSavingRole(false);
    }
  };

  return (
    <div className="app-layout">
      <SessionsSidebar
        sessions={sessions}
        activeId={activeSessionId || undefined}
        onSelect={(id) => setActiveSessionId(id)}
        onNew={async () => {
          const ns = await createSession('New Chat');
          setSessions(prev => [ns, ...prev]);
          setActiveSessionId(ns.id);
        }}
        onDeleteSession={async (id) => {
          try {
            await deleteSession(id);
            setSessions(prev => prev.filter(s => s.id !== id));
            // If we deleted the active session, select the first one or create a new one
            if (activeSessionId === id) {
              const remainingSessions = sessions.filter(s => s.id !== id);
              if (remainingSessions.length > 0) {
                setActiveSessionId(remainingSessions[0].id);
              } else {
                const ns = await createSession('New Chat');
                setSessions([ns]);
                setActiveSessionId(ns.id);
              }
            }
          } catch (e) {
            console.error('Failed to delete session', e);
            alert('Failed to delete session');
          }
        }}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
        roles={roles}
        activeRoleId={activeRoleId || undefined}
        onSelectRole={(id) => setActiveRoleId(id)}
        onCreateRole={async (name, instructions) => {
          try {
            const r = await createRole(name, instructions);
            setRoles(prev => [...prev, r].sort((a,b)=>a.name.localeCompare(b.name)));
          } catch (e) {
            alert('Failed to create role');
          }
        }}
        onEditRole={startEditRole}
        onDeleteRole={async (id) => {
          try {
            await deleteRole(id);
            setRoles(prev => prev.filter(r => r.id !== id));
            // If we deleted the active role, clear the active role
            if (activeRoleId === id) {
              setActiveRoleId(null);
            }
          } catch (e) {
            console.error('Failed to delete role', e);
            alert('Failed to delete role');
          }
        }}
        onStartCreateRole={startCreateRole}
      />
      <div className="right-pane">
        <div className="chat-container">
        {(editingRole || creatingRole) ? (
          <div className="role-editor-panel">
            {editingRole && (
              <>
                <div className="role-editor-header">
                  <h2>Edit Role</h2>
                  <div className="role-editor-actions">
                    <button onClick={cancelEditRole} disabled={savingRole}>Cancel</button>
                    <button onClick={saveRoleEdits} disabled={savingRole || (newRoleName.trim().length === 0) || (editingRoleText.trim().length === 0)}>{savingRole? 'Saving...' : 'Save'}</button>
                  </div>
                </div>
                <input
                  type="text"
                  className="role-editor-textarea"
                  style={{minHeight: 'auto'}}
                  placeholder="Role name"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                />
                <textarea
                  className="role-editor-textarea"
                  value={editingRoleText}
                  onChange={e => setEditingRoleText(e.target.value)}
                  rows={18}
                  placeholder="Role instructions..."
                />
              </>
            )}
            {creatingRole && (
              <>
                <div className="role-editor-header">
                  <h2>New Role</h2>
                  <div className="role-editor-actions">
                    <button onClick={cancelEditRole} disabled={savingRole}>Cancel</button>
                    <button onClick={saveNewRole} disabled={savingRole || !newRoleName.trim() || !newRoleInstructions.trim()}>{savingRole? 'Saving...' : 'Create'}</button>
                  </div>
                </div>
                <input
                  type="text"
                  className="role-editor-textarea"
                  style={{minHeight: 'auto'}}
                  placeholder="Role name"
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                />
                <textarea
                  className="role-editor-textarea"
                  value={newRoleInstructions}
                  onChange={e => setNewRoleInstructions(e.target.value)}
                  rows={18}
                  placeholder="Role instructions..."
                />
              </>
            )}
          </div>
        ) : (
        <>
        <div className="chat-header">
          <div className="header-left">
            <ModelSelector
              models={models}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              isLoading={modelsLoading}
              error={modelsError}
            />
            <button 
              onClick={refreshModels}
              className="refresh-models-button"
              disabled={modelsLoading}
              title="Refresh models"
            >
              🔄
            </button>
            <div className="header-title">
              {planMode && (
                <div className="plan-mode-indicator">
                  Plan Mode: {planningModel} → {answeringModel}
                </div>
              )}
            </div>
          </div>
          <div className="header-controls">
            <button 
              onClick={toggleTheme}
              className="theme-toggle"
              aria-label="Toggle theme"
              title={theme === 'light' ? 'Switch to dark' : 'Switch to light'}
            >
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            {authContext && (
              <button 
                onClick={authContext.logout}
                className="logout-button"
                aria-label="Logout"
                title="Logout"
              >
                Logout
              </button>
            )}
          </div>
        </div>

        <div className="messages-container">
          {messages.length === 0 && (
            <div className="welcome-message">
              <h2>Welcome to Chat2AnyLLM</h2>
              <p>Start a conversation by typing a message below.</p>
              {selectedModel && (
                <p className="current-model">Using model: <strong>{selectedModel}</strong></p>
              )}
            </div>
          )}
          
          {messages.map((message) => (
            <ChatMessage key={message.id} message={message} onEdit={handleEditMessage} />
          ))}
          
          {connectionError && (
            <div className="error-message">
              {connectionError}
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

  <div className="input-container" ref={inputContainerRef}>
          <textarea
            ref={textareaRef}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onInput={autoResize}
            onKeyDown={handleKeyDown}
            placeholder={editingMessage ? "Edit your message..." : "Type your message..."}
            className="message-input"
            rows={1}
            disabled={isLoading}
          />
          {suggestionsOpen && suggestions.length > 0 && (
            <div className="slash-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <div
                  key={s.kind === 'command' ? `cmd-${s.id}` : `model-${s.title}`}
                  className={`slash-suggestion ${i === activeSuggestion ? 'active' : ''}`}
                  role="option"
                  aria-selected={i === activeSuggestion}
                  onMouseEnter={() => setActiveSuggestion(i)}
                  onMouseDown={(e) => {
                    // prevent textarea blur
                    e.preventDefault();
                    s.run();
                  }}
                >
                  <div className="title">{s.title}</div>
                  {s.subtitle && <div className="subtitle">{s.subtitle}</div>}
                </div>
              ))}
            </div>
          )}
          <button 
            onClick={handleSendMessage}
            className="send-button"
            disabled={!inputMessage.trim() || isLoading || (!selectedModel && models.length > 0)}
          >
            {isLoading ? 'Sending...' : editingMessage ? 'Update' : 'Send'}
          </button>
          <button
            onClick={clearChat}
            className="clear-button clear-input-button"
            disabled={messages.length === 0}
            title="Clear"
          >
            Clear
          </button>
        </div>
  </>
  )}
  </div>
      </div>
    </div>
  );
};
