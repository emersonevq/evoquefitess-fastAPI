import React, { useState, useRef, useEffect, useCallback } from "react";
import { models, factories, service, Report, IReportEmbedConfiguration } from "powerbi-client";
import { Dashboard } from "../hooks/useDashboards";
import { apiFetch } from "@/lib/api";
import {
  Activity, AlertCircle, ChevronDown, Clock, Code, Database,
  Layers, Loader2, Lock, Maximize2, Minimize2, Play,
  RefreshCw, Shield, Sparkles, Terminal, X
} from "lucide-react";

interface DashboardViewerProps {
  dashboard: Dashboard;
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

// Abordagem completamente diferente: Usar sistema de pools e ciclo de vida controlado
export default function DashboardViewer({
  dashboard,
  onError,
  onSuccess
}: DashboardViewerProps) {
  // Estados da UI
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState<string>("initial");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<{message: string, type: string, timestamp: number}[]>([]);
  
  // Referências essenciais
  const containerRef = useRef<HTMLDivElement>(null);
  const embedContainerRef = useRef<HTMLDivElement>(null);
  const powerBiReport = useRef<Report | null>(null);
  const powerBiService = useRef<service.Service | null>(null);
  const currentSessionId = useRef<string>(crypto.randomUUID());
  const currentReportId = useRef<string>("");
  const isMounted = useRef(true);
  const tokenCache = useRef<{[key: string]: {token: string, embedUrl: string, expires: number}}>({});
  const attemptCounter = useRef<number>(0);
  const workspaceClean = useRef<boolean>(true);
  
  // Novo: Sistema de sanidade para verificação de ambiente
  const environmentChecks = useRef<{[key: string]: boolean}>({
    iframeClean: true,
    domStable: true,
    serviceReady: false,
    tokenValid: false,
    urlValidated: false
  });
  
  // Novo: Gerenciador de log com timestamps e categorias
  const logger = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warn' | 'debug' = 'info') => {
    const timestamp = Date.now();
    const entry = { message, type, timestamp };
    console.log(`[PowerBI] [${type.toUpperCase()}] ${message}`);
    
    setLogs(prev => {
      // Limitar a 100 logs para desempenho
      const newLogs = [...prev, entry];
      if (newLogs.length > 100) return newLogs.slice(-100);
      return newLogs;
    });
    
    return timestamp; // Retorna timestamp para medição de duração
  }, []);

  // NOVO: Sistema de temporização para detecção de problemas
  const timerRef = useRef<{[key: string]: number}>({});
  const startTimer = useCallback((label: string) => {
    timerRef.current[label] = performance.now();
    logger(`Timer iniciado: ${label}`, 'debug');
  }, [logger]);
  
  const endTimer = useCallback((label: string) => {
    if (!timerRef.current[label]) return 0;
    const duration = performance.now() - timerRef.current[label];
    logger(`${label}: ${duration.toFixed(2)}ms`, 'debug');
    delete timerRef.current[label];
    return duration;
  }, [logger]);

  // NOVO: Verificação de sanidade do DOM
  const verifyDomSanity = useCallback(() => {
    if (!embedContainerRef.current) {
      environmentChecks.current.domStable = false;
      return false;
    }
    
    // Verificar iframes residuais
    const powerBiIframes = document.querySelectorAll('iframe[src*="powerbi"]');
    environmentChecks.current.iframeClean = powerBiIframes.length === 0;
    
    // Verificar contenção DOM
    const containerIframes = embedContainerRef.current.querySelectorAll('iframe');
    
    logger(`Verificação de sanidade DOM: ${powerBiIframes.length} iframes PowerBI no documento, ${containerIframes.length} no container`, powerBiIframes.length === 0 ? 'info' : 'warn');
    
    return environmentChecks.current.domStable && environmentChecks.current.iframeClean;
  }, [logger]);

  // NOVO: Limpeza controlada com verificação (bem diferente da abordagem anterior)
  const performHygiene = useCallback(async (deep = false) => {
    startTimer('hygiene');
    
    if (!isMounted.current) return;
    workspaceClean.current = false;
    
    logger('Iniciando higienização do ambiente...', deep ? 'warn' : 'info');
    
    // 1. Revogar todas as referências atuais
    if (powerBiReport.current) {
      try {
        powerBiReport.current.off('loaded');
        powerBiReport.current.off('rendered');
        powerBiReport.current.off('error');
        logger('Eventos do relatório desconectados', 'success');
      } catch (e) {
        // Ignorar erros - é normal
      }
      powerBiReport.current = null;
    }
    
    // 2. CORREÇÃO CRÍTICA: Resetar o serviço PowerBI para limpar registros internos
    if (powerBiService.current) {
      try {
        // Remover todos os embeds registrados no serviço
        powerBiService.current.reset(embedContainerRef.current!);
        logger('Serviço PowerBI resetado com sucesso', 'success');
      } catch (e) {
        logger('Aviso ao resetar serviço (pode ser normal)', 'warn');
      }
    }
    
    // 3. Criar nova instância do serviço se necessário
    if (deep || !powerBiService.current) {
      logger('Criando nova instância do PowerBI Service', 'info');
      powerBiService.current = new service.Service(
        factories.hpmFactory, 
        factories.wpmpFactory, 
        factories.routerFactory
      );
      environmentChecks.current.serviceReady = true;
    }
    
    // 3. Verificação e limpeza de iframes - SEMPRE fazer ao trocar dashboard
    const allIframes = document.querySelectorAll('iframe[src*="powerbi"]');
    if (allIframes.length > 0 || deep) {
      logger(`Removendo ${allIframes.length} iframes PowerBI residuais`, 'warn');
      allIframes.forEach(iframe => {
        try {
          iframe.remove();
        } catch (e) {
          logger('Erro ao remover iframe, tentando pelo parent', 'warn');
          iframe.parentNode?.removeChild(iframe);
        }
      });
      // Aguardar um pouco para garantir remoção
      await new Promise(r => setTimeout(r, 100));
    }
    
    // 4. Preparar o container para novo embed
    if (embedContainerRef.current) {
      // Novo: abordagem diferente - preservar o DOM, mas limpar conteúdo
      // ao invés de innerHTML = "" que pode causar problemas com event listeners
      while (embedContainerRef.current.firstChild) {
        embedContainerRef.current.removeChild(embedContainerRef.current.firstChild);
      }
      
      // Garantir que o container está pronto para receber novo conteúdo
      embedContainerRef.current.style.height = '100%';
      embedContainerRef.current.style.width = '100%';
      
      // Remover qualquer estado residual do PowerBI
      embedContainerRef.current.removeAttribute('powerbi-embed-url');
      embedContainerRef.current.removeAttribute('powerbi-type');
      embedContainerRef.current.removeAttribute('powerbi-id');
      
      logger('Container preparado para novo embed', 'success');
    }
    
    // 5. Nova abordagem: Verificação de sanidade após limpeza
    const isClean = verifyDomSanity();
    workspaceClean.current = isClean;
    
    // 6. Esperar estabilização do browser
    await new Promise(resolve => setTimeout(resolve, deep ? 750 : 200));
    
    endTimer('hygiene');
    return isClean;
  }, [logger, verifyDomSanity, startTimer, endTimer]);

  // NOVO: Validação de URL com abordagem completamente diferente
  const validateEmbedUrl = useCallback((url: string): boolean => {
    startTimer('validateUrl');
    
    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      logger('URL inválida: vazia ou não-string', 'error');
      return false;
    }
    
    // Abordagem diferente: Validação progressiva
    let valid = true;
    
    // Validação básica
    if (!url.startsWith('https://')) {
      logger(`URL inválida: deve começar com https:// (encontrado: ${url.substring(0, 10)}...)`, 'error');
      valid = false;
    }
    
    // Verificação de domínio - usando RegExp com flags corretas (sem g)
    const domainRegex = /^https:\/\/app\.powerbi\.com\//i;
    if (!domainRegex.test(url)) {
      logger(`URL inválida: domínio deve ser app.powerbi.com`, 'error');
      valid = false;
    }
    
    // Verificação de endpoint - evitando regex com estado (g)
    const isReportEmbed = url.includes('/reportEmbed');
    if (!isReportEmbed) {
      logger(`URL inválida: deve conter /reportEmbed`, 'error');
      valid = false;
    }
    
    // Verificação de IDs - abordagem totalmente diferente da original
    try {
      const urlObj = new URL(url);
      const params = new URLSearchParams(urlObj.search);
      
      const reportId = params.get('reportId');
      const expectedId = dashboard.report_id;
      
      if (!reportId) {
        logger('URL inválida: reportId ausente', 'error');
        valid = false;
      } else if (reportId !== expectedId) {
        logger(`URL inválida: reportId ${reportId} não corresponde ao esperado ${expectedId}`, 'error');
        valid = false;
      } else {
        logger('reportId validado com sucesso', 'success');
      }
    } catch (e) {
      logger(`Erro ao analisar URL: ${e instanceof Error ? e.message : String(e)}`, 'error');
      valid = false;
    }
    
    const duration = endTimer('validateUrl');
    logger(`URL ${valid ? 'válida ✅' : 'inválida ❌'} (${duration.toFixed()}ms)`, valid ? 'success' : 'error');
    
    environmentChecks.current.urlValidated = valid;
    return valid;
  }, [dashboard.report_id, logger, startTimer, endTimer]);

  // NOVO: Obtenção de token com cache
  const getEmbedToken = useCallback(async (): Promise<{token: string, embedUrl: string} | null> => {
    startTimer('tokenRequest');
    
    if (!isMounted.current) return null;
    
    // Verificar cache
    const cacheKey = `${dashboard.report_id}:${dashboard.dataset_id}`;
    const cachedData = tokenCache.current[cacheKey];
    
    // Ao trocar de dashboard, sempre buscar novo token (não usar cache)
    const isNewDashboard = currentReportId.current !== dashboard.report_id;
    const shouldUseCache = !isNewDashboard && cachedData && cachedData.expires > Date.now();
    
    if (shouldUseCache) {
      logger('Token encontrado em cache e ainda válido', 'success');
      endTimer('tokenRequest');
      environmentChecks.current.tokenValid = true;
      return {
        token: cachedData.token,
        embedUrl: cachedData.embedUrl
      };
    }
    
    if (isNewDashboard && cachedData) {
      logger('Novo dashboard detectado, ignorando cache e buscando novo token', 'info');
      delete tokenCache.current[cacheKey];
    }
    
    try {
      logger('Solicitando novo token de acesso...', 'info');
      
      // Criar um novo AbortController para esta solicitação
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await apiFetch(
        `/powerbi/embed-token/${dashboard.report_id}?datasetId=${dashboard.dataset_id}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const statusText = response.statusText;
        const errorBody = await response.text();
        
        logger(`Erro HTTP ${response.status} ao obter token: ${statusText}`, 'error');
        logger(`Detalhes do erro: ${errorBody}`, 'error');
        
        return null;
      }
      
      const data = await response.json();
      
      if (!data.token || !data.embedUrl) {
        logger('Token ou URL ausentes na resposta', 'error');
        return null;
      }
      
      // Armazenar em cache com expiração (5 minutos antes da expiração real)
      const tokenExpiresIn = 3600000; // 1 hora (ajustar conforme API)
      tokenCache.current[cacheKey] = {
        token: data.token,
        embedUrl: data.embedUrl,
        expires: Date.now() + tokenExpiresIn - 300000 // 5 minutos antes
      };
      
      environmentChecks.current.tokenValid = true;
      logger(`Token obtido com sucesso (${data.token.substring(0, 15)}...)`, 'success');
      
      endTimer('tokenRequest');
      return {
        token: data.token,
        embedUrl: data.embedUrl
      };
      
    } catch (e) {
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          logger('Solicitação de token cancelada por timeout', 'error');
        } else {
          logger(`Erro ao obter token: ${e.message}`, 'error');
        }
      } else {
        logger(`Erro desconhecido ao obter token: ${String(e)}`, 'error');
      }
      
      endTimer('tokenRequest');
      return null;
    }
  }, [dashboard.report_id, dashboard.dataset_id, logger, startTimer, endTimer]);

  // NOVO: Sistema de embed com gerenciamento de ciclo de vida
  const embedReport = useCallback(async (force = false): Promise<boolean> => {
    startTimer('embedReport');
    
    if (!isMounted.current) return false;
    if (isLoading && !force) {
      logger('Carregamento já em andamento, ignorando solicitação', 'info');
      return false;
    }
    
    setIsLoading(true);
    setIsReady(false);
    setError(null);
    attemptCounter.current++;
    
    logger(`Iniciando carregamento do dashboard (tentativa ${attemptCounter.current})`, 'info');
    
    try {
      // Nova abordagem: gerenciamento de sessão
      currentSessionId.current = crypto.randomUUID();
      const sessionId = currentSessionId.current;
      currentReportId.current = dashboard.report_id;
      
      // Fase 1: Preparação do ambiente
      setLoadingPhase('preparing');
      setLoadingProgress(10);
      
      // Verificar se precisamos de uma limpeza profunda ou simples
      const needsDeepClean = !workspaceClean.current || attemptCounter.current > 1;
      await performHygiene(needsDeepClean);
      
      if (!isMounted.current || sessionId !== currentSessionId.current) {
        logger('Sessão cancelada após limpeza', 'info');
        return false;
      }
      
      setLoadingProgress(25);
      
      // Fase 2: Autenticação
      setLoadingPhase('authenticating');
      const tokenData = await getEmbedToken();
      
      if (!tokenData || !isMounted.current || sessionId !== currentSessionId.current) {
        logger('Sessão cancelada ou falha na autenticação', 'error');
        throw new Error('Falha ao obter credenciais de acesso');
      }
      
      setLoadingProgress(40);
      
      // Fase 3: Validação
      setLoadingPhase('validating');
      const isUrlValid = validateEmbedUrl(tokenData.embedUrl);
      
      if (!isUrlValid) {
        throw new Error('URL de embed inválida');
      }
      
      setLoadingProgress(55);
      
      // Fase 4: Configuração
      setLoadingPhase('configuring');
      if (!embedContainerRef.current || !powerBiService.current) {
        throw new Error('Container ou serviço não disponível');
      }
      
      // Aguardar estabilização do DOM antes de embedar
      await new Promise(r => setTimeout(r, 200));
      
      if (!isMounted.current || sessionId !== currentSessionId.current) {
        logger('Sessão cancelada durante espera de estabilização', 'info');
        return false;
      }
      
      // Nova configuração com definições otimizadas
      const embedConfig: IReportEmbedConfiguration = {
        type: 'report',
        id: dashboard.report_id,
        embedUrl: tokenData.embedUrl,
        accessToken: tokenData.token,
        tokenType: models.TokenType.Embed,
        permissions: models.Permissions.Read,
        settings: {
          filterPaneEnabled: true,
          navContentPaneEnabled: true,
          background: models.BackgroundType.Transparent,
          layoutType: models.LayoutType.Custom,
          customLayout: {
            displayOption: models.DisplayOption.FitToWidth,
          },
          localeSettings: {
            language: 'pt-BR',
            formatLocale: 'pt-BR'
          },
          visualRenderedEvents: true,
          persistentFiltersEnabled: true
        }
      };
      
      logger('Configuração pronta para embed', 'success');
      setLoadingProgress(70);
      
      // Fase 5: Renderização
      setLoadingPhase('rendering');
      
      // Garantir visibilidade do container
      embedContainerRef.current.style.display = 'block';
      
      // Embed com Promise para melhor controle
      logger('Executando embed do relatório...', 'info');
      
      return new Promise<boolean>((resolve) => {
        if (!embedContainerRef.current || !powerBiService.current || !isMounted.current) {
          resolve(false);
          return;
        }
        
        // Usar setTimeout assíncrono para evitar problemas de temporização do React
        setTimeout(async () => {
          if (!embedContainerRef.current || !powerBiService.current || !isMounted.current) {
            resolve(false);
            return;
          }
          
          try {
            // CORREÇÃO CRÍTICA: Verificar e remover embed existente antes de criar novo
            if (embedContainerRef.current && powerBiService.current) {
              try {
                const existingEmbed = powerBiService.current.get(embedContainerRef.current);
                if (existingEmbed) {
                  logger('Removendo embed existente encontrado no elemento', 'warn');
                  powerBiService.current.reset(embedContainerRef.current);
                  // Aguardar um pouco para garantir que foi removido
                  await new Promise(r => setTimeout(r, 100));
                }
              } catch (e) {
                // Ignorar erro se não houver embed existente
                logger('Nenhum embed existente detectado (normal)', 'debug');
              }
            }
            
            const report = powerBiService.current.embed(
              embedContainerRef.current,
              embedConfig
            ) as Report;
            
            // Armazenar referência
            powerBiReport.current = report;
            
            // Registrar eventos com melhor sistema de log
            let isResolved = false;
            
            const handleLoaded = () => {
              logger('Relatório carregado, aguardando renderização completa...', 'success');
              setLoadingProgress(85);
              setLoadingPhase('finalizing');
            };
            
            const handleRendered = () => {
              const renderTime = endTimer('embedReport');
              
              if (isResolved || !isMounted.current) return;
              isResolved = true;
              
              logger(`Dashboard renderizado com sucesso (${renderTime.toFixed()}ms) ✨`, 'success');
              setLoadingProgress(100);
              setIsLoading(false);
              setIsReady(true);
              setError(null);
              attemptCounter.current = 0;
              
              // Notificar sucesso
              if (onSuccess) onSuccess();
              
              resolve(true);
            };
            
            const handleError = async (event: any) => {
              const errorMsg = event?.detail?.message || 'Erro desconhecido';
              logger(`Erro na renderização: ${errorMsg}`, 'error');
              
              // Se já resolvido, não fazer nada
              if (isResolved || !isMounted.current) return;
              
              // Se for erro de URL ou embed, tentar novamente automaticamente (até 3 tentativas)
              const isUrlError = errorMsg.includes('Invalid embed URL') || 
                                errorMsg.includes('embed') || 
                                errorMsg.includes('URL');
              
              if (isUrlError && attemptCounter.current <= 3) {
                logger(`Tentativa ${attemptCounter.current}/3: Erro de URL detectado, tentando novamente automaticamente...`, 'warn');
                
                // Não mostrar erro ao usuário, apenas tentar novamente
                try {
                  // Limpar completamente
                  await performHygiene(true);
                  
                  // Aguardar mais tempo para garantir limpeza completa
                  await new Promise(r => setTimeout(r, 1000));
                  
                  if (isMounted.current && sessionId === currentSessionId.current) {
                    // Tentar novamente com força
                    const success = await embedReport(true);
                    resolve(success);
                  } else {
                    resolve(false);
                  }
                } catch (e) {
                  logger(`Erro durante retry: ${e instanceof Error ? e.message : String(e)}`, 'error');
                  // Se falhar mesmo após retries, mostrar erro
                  if (attemptCounter.current >= 3) {
                    isResolved = true;
                    setError('Não foi possível carregar após múltiplas tentativas');
                    setIsLoading(false);
                    if (onError) onError(errorMsg);
                    resolve(false);
                  }
                }
                return;
              }
              
              // Caso contrário, considerar como falha
              isResolved = true;
              setError(errorMsg);
              setIsLoading(false);
              if (onError) onError(errorMsg);
              resolve(false);
            };
            
            // Registrar eventos
            report.on('loaded', handleLoaded);
            report.on('rendered', handleRendered);
            report.on('error', handleError);
            
            // Timeout de segurança (45s - aumentado para dar mais tempo ao trocar dashboards)
            setTimeout(() => {
              if (!isResolved && isMounted.current) {
                isResolved = true;
                logger('Timeout ao aguardar renderização do relatório', 'error');
                
                // Se for primeira tentativa, tentar novamente
                if (attemptCounter.current <= 2) {
                  logger('Timeout na primeira tentativa, tentando novamente...', 'warn');
                  performHygiene(true).then(() => {
                    setTimeout(() => {
                      if (isMounted.current) {
                        embedReport(true);
                      }
                    }, 500);
                  });
                } else {
                  setError('Timeout ao carregar dashboard');
                  setIsLoading(false);
                  if (onError) onError('Timeout ao carregar dashboard');
                  resolve(false);
                }
              }
            }, 45000);
            
          } catch (e) {
            const errorMsg = e instanceof Error ? e.message : String(e);
            logger(`Erro ao executar embed: ${errorMsg}`, 'error');
            setError(errorMsg);
            setIsLoading(false);
            if (onError) onError(errorMsg);
            resolve(false);
          }
        }, 100);
      });
      
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      logger(`Erro no processo de carregamento: ${errorMsg}`, 'error');
      setError(errorMsg);
      setIsLoading(false);
      if (onError) onError(errorMsg);
      endTimer('embedReport');
      return false;
    }
  }, [
    dashboard, isLoading, performHygiene, getEmbedToken,
    validateEmbedUrl, logger, onSuccess, onError, startTimer, endTimer
  ]);

  // Inicialização: detectar mudança de dashboard
  useEffect(() => {
    if (currentReportId.current !== dashboard.report_id) {
      logger(`Dashboard alterado: ${dashboard.title}`, 'info');
      attemptCounter.current = 0; // Resetar contador ao mudar de dashboard
      
      // Limpar cache de token do dashboard anterior para forçar novo token
      const oldCacheKey = `${currentReportId.current}:${dashboard.dataset_id}`;
      delete tokenCache.current[oldCacheKey];
      
      // Limpar e carregar automaticamente o novo dashboard com limpeza profunda
      setIsReady(false);
      setError(null);
      performHygiene(true).then(() => {
        // Aguardar um pouco após limpeza profunda antes de carregar
        setTimeout(() => {
          if (isMounted.current) {
            embedReport(true);
          }
        }, 500);
      });
    }
  }, [dashboard.report_id, dashboard.title, dashboard.dataset_id, embedReport, logger, performHygiene]);
  
  // Cleanup ao desmontar
  useEffect(() => {
    isMounted.current = true;
    
    // Fullscreen change listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      isMounted.current = false;
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      
      // Limpar recursos
      if (powerBiReport.current) {
        try {
          powerBiReport.current.off('loaded');
          powerBiReport.current.off('rendered');
          powerBiReport.current.off('error');
        } catch (e) {
          // Ignorar erros
        }
      }
      
      // Limpar iframes residuais
      try {
        document.querySelectorAll('iframe[src*="powerbi"]').forEach(iframe => {
          iframe.remove();
        });
      } catch (e) {
        // Ignorar erros
      }
    };
  }, []);
  
  // Toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch (e) {
      logger(`Erro ao alternar tela cheia: ${e instanceof Error ? e.message : String(e)}`, 'error');
    }
  };
  
  // Formatar timestamp para exibição
  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Iniciar carregamento do dashboard
  const handleStartLoading = () => {
    embedReport();
  };
  
  // Tentar novamente
  const handleRetry = () => {
    embedReport(true);
  };
  
  // Obter ícone da fase
  const getPhaseIcon = () => {
    switch (loadingPhase) {
      case 'preparing': return <Loader2 className="animate-spin" />;
      case 'authenticating': return <Lock />;
      case 'validating': return <Shield />;
      case 'configuring': return <Layers />;
      case 'rendering': return <Activity />;
      case 'finalizing': return <Sparkles />;
      default: return <Database />;
    }
  };
  
  // Obter texto da fase
  const getPhaseText = () => {
    switch (loadingPhase) {
      case 'preparing': return 'Preparando ambiente...';
      case 'authenticating': return 'Autenticando...';
      case 'validating': return 'Validando configurações...';
      case 'configuring': return 'Configurando dashboard...';
      case 'rendering': return 'Renderizando visualizações...';
      case 'finalizing': return 'Finalizando carregamento...';
      default: return 'Iniciando...';
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col h-full w-full relative bg-gradient-to-br from-slate-50 to-blue-50 overflow-hidden"
    >
      {/* Barra de Status */}
      <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm z-10">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            {isReady ? (
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            ) : isLoading ? (
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
            ) : error ? (
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            ) : (
              <div className="w-3 h-3 bg-gray-300 rounded-full"></div>
            )}
            <span className="font-medium text-gray-700">{dashboard.title}</span>
          </div>
          
          {isLoading && (
            <div className="flex items-center text-xs text-gray-500 space-x-2">
              <span>{getPhaseText()}</span>
              <div className="w-24 bg-gray-200 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-300" 
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="text-xs font-medium text-red-600 flex items-center space-x-1">
              <AlertCircle className="w-3 h-3" />
              <span>{error}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setShowDebug(!showDebug)}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Depuração"
          >
            <Terminal className="w-4 h-4" />
          </button>
          
          <button 
            onClick={toggleFullscreen}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            title="Tela cheia"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>
      
      {/* Área principal */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Container do dashboard */}
        <div
          ref={embedContainerRef}
          className="absolute inset-0 bg-white"
          style={{ display: isReady ? 'block' : 'none' }}
        ></div>
        
        {/* Estado de carregamento */}
        {isLoading && !isReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
            <div className="text-center p-6 max-w-md">
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-blue-100 rounded-full"></div>
                <svg
                  className="absolute inset-0"
                  viewBox="0 0 100 100"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <circle
                    className="text-blue-600"
                    strokeWidth="8"
                    stroke="currentColor"
                    fill="transparent"
                    r="46"
                    cx="50"
                    cy="50"
                    style={{
                      strokeDasharray: '289.027px',
                      strokeDashoffset: `${289.027 - (loadingProgress / 100) * 289.027}px`,
                      transformOrigin: 'center',
                      transform: 'rotate(-90deg)',
                    }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-lg font-semibold text-blue-700">{loadingProgress}%</span>
                </div>
              </div>
              
              <div className="flex items-center justify-center gap-2 mb-3">
                {getPhaseIcon()}
                <h3 className="text-xl font-semibold text-gray-800">{getPhaseText()}</h3>
              </div>
              
              <p className="text-gray-600 mb-4">{dashboard.description}</p>
            </div>
          </div>
        )}
        
        {/* Estado de erro ou inicial */}
        {!isLoading && !isReady && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 border border-gray-200">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-50 mb-4">
                  {error ? (
                    <AlertCircle className="w-8 h-8 text-red-500" />
                  ) : (
                    <Play className="w-8 h-8 text-blue-500" />
                  )}
                </div>
                
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {error ? 'Falha ao carregar dashboard' : dashboard.title}
                </h2>
                
                <p className="text-gray-600">
                  {error || dashboard.description}
                </p>
              </div>
              
              <div className="space-y-3">
                {error ? (
                  <button
                    onClick={handleRetry}
                    className="w-full py-2.5 px-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Tentar novamente
                  </button>
                ) : (
                  <button
                    onClick={handleStartLoading}
                    className="w-full py-2.5 px-4 flex items-center justify-center gap-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Play className="w-4 h-4" />
                    Carregar Dashboard
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Painel de depuração */}
        {showDebug && (
          <div className="absolute right-0 top-0 bottom-0 w-96 bg-slate-900 text-white shadow-xl z-20 flex flex-col overflow-hidden border-l border-slate-700">
            <div className="p-3 border-b border-slate-700 flex items-center justify-between bg-slate-800">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-blue-400" />
                <h3 className="font-mono text-sm font-medium">Console de Depuração</h3>
              </div>
              <button
                onClick={() => setShowDebug(false)} 
                className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs">
              <div className="space-y-1">
                {logs.map((log, idx) => (
                  <div 
                    key={`${log.timestamp}-${idx}`}
                    className={`py-1 px-2 rounded ${
                      log.type === 'error' ? 'bg-red-950 text-red-300' :
                      log.type === 'success' ? 'bg-green-950 text-green-300' :
                      log.type === 'warn' ? 'bg-yellow-950 text-yellow-300' :
                      'text-slate-300'
                    }`}
                  >
                    <span className="text-slate-500 mr-1">{formatTimestamp(log.timestamp)}</span>
                    <span>{log.message}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="text-slate-500 p-4 text-center">
                    Nenhum log disponível
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-3 border-t border-slate-700 bg-slate-800">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => performHygiene(true)} 
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                >
                  Limpeza Forçada
                </button>
                <button
                  onClick={() => embedReport(true)}
                  className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-xs"
                >
                  Recarregar Dashboard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
