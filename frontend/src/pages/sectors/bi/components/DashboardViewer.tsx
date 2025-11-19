// DashboardViewer.tsx - VERSÃO COM LIMPEZA RADICAL
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Dashboard } from "../hooks/useDashboards";
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  Shield,
  Server,
  Link as LinkIcon,
  Maximize2,
  Minimize2,
  Activity,
  Play,
  Info,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import * as pbi from "powerbi-client";

interface DashboardViewerProps {
  dashboard: Dashboard;
}

type LoadPhase =
  | "idle"
  | "cleaning"
  | "validating"
  | "authenticating"
  | "connecting"
  | "loading"
  | "ready"
  | "error";

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export default function DashboardViewer({
  dashboard,
}: DashboardViewerProps) {
  const [phase, setPhase] = useState<LoadPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [hasStarted, setHasStarted] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const embedRef = useRef<HTMLDivElement>(null);
  const reportRef = useRef<pbi.Report | null>(null);
  const serviceRef = useRef<pbi.service.Service | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentDashboardIdRef = useRef<string>(dashboard.report_id);
  const isCleaningRef = useRef(false);

  const MAX_RETRIES = 3;

  // 📝 Logger
  const addLog = useCallback((message: string, type: "info" | "error" | "success" = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    const emoji = type === "error" ? "❌" : type === "success" ? "✅" : "ℹ️";
    const logMessage = `[${timestamp}] ${emoji} ${message}`;
    console.log(`[PowerBI] ${logMessage}`);
    setLogs((prev) => [...prev.slice(-4), logMessage]);
  }, []);

  // 🧹 LIMPEZA RADICAL - VERSÃO MELHORADA
  const radicalCleanup = useCallback(async () => {
    if (isCleaningRef.current) {
      addLog("Limpeza já em andamento, aguardando...", "info");
      return;
    }

    isCleaningRef.current = true;
    addLog("🧹 INICIANDO LIMPEZA RADICAL", "info");

    try {
      // 1. Abortar TODAS as requisições
      if (abortControllerRef.current) {
        try {
          abortControllerRef.current.abort();
          addLog("Requisições HTTP abortadas", "success");
        } catch (e) {
          addLog("Erro ao abortar requisições", "error");
        }
        abortControllerRef.current = null;
      }

      // 2. Remover TODOS os event listeners do report
      if (reportRef.current) {
        try {
          reportRef.current.off("loaded");
          reportRef.current.off("rendered");
          reportRef.current.off("error");
          reportRef.current.off("saved");
          reportRef.current.off("dataSelected");
          addLog("Event listeners removidos", "success");
        } catch (e) {
          addLog("Erro ao remover listeners", "error");
        }
        reportRef.current = null;
      }

      // 3. DESTRUIR o Power BI Service completamente
      if (serviceRef.current) {
        try {
          // Se houver container, tentar resetar
          if (embedRef.current) {
            serviceRef.current.reset(embedRef.current);
            addLog("Service resetado via container", "success");
          }
        } catch (e) {
          addLog("Erro ao resetar service (esperado)", "info");
        }

        // Destruir a instância
        serviceRef.current = null;
        addLog("Service instance destruída", "success");
      }

      // 4. LIMPAR O CONTAINER COMPLETAMENTE
      if (embedRef.current) {
        try {
          // Remover todos os iframes
          const iframes = embedRef.current.querySelectorAll("iframe");
          iframes.forEach((iframe, idx) => {
            try {
              iframe.remove();
              addLog(`iframe ${idx + 1} removido`, "success");
            } catch (e) {
              addLog(`Erro ao remover iframe ${idx + 1}`, "error");
            }
          });

          // Remover todos os elementos filhos
          while (embedRef.current.firstChild) {
            embedRef.current.removeChild(embedRef.current.firstChild);
          }

          // Limpar innerHTML como fallback
          embedRef.current.innerHTML = "";

          // Remover TODOS os atributos customizados
          const attributes = Array.from(embedRef.current.attributes);
          attributes.forEach((attr) => {
            if (
              attr.name.startsWith("powerbi-") ||
              attr.name.startsWith("data-") ||
              attr.name.startsWith("aria-") ||
              attr.name === "tabindex"
            ) {
              embedRef.current?.removeAttribute(attr.name);
            }
          });

          // Resetar classes
          embedRef.current.className = "flex-1 bg-white";

          // Resetar estilos inline
          embedRef.current.style.cssText = "display: none;";

          addLog("Container COMPLETAMENTE limpo", "success");
        } catch (e) {
          addLog("Erro ao limpar container", "error");
        }
      }

      // 5. Aguardar para garantir que tudo foi limpo
      await new Promise((resolve) => setTimeout(resolve, 300));
      addLog("Aguardando finalização da limpeza...", "info");

      // 6. Verificação final
      if (embedRef.current) {
        const hasChildren = embedRef.current.children.length > 0;
        const hasIframes = embedRef.current.querySelectorAll("iframe").length > 0;

        if (hasChildren || hasIframes) {
          addLog(`⚠️ ATENÇÃO: Container ainda tem elementos (children: ${hasChildren}, iframes: ${hasIframes})`, "error");
          // Tentar limpar de novo
          embedRef.current.innerHTML = "";
        } else {
          addLog("✅ Container verificado: TOTALMENTE LIMPO", "success");
        }
      }

      addLog("🎉 LIMPEZA RADICAL CONCLUÍDA", "success");
    } finally {
      isCleaningRef.current = false;
    }
  }, [addLog]);

  // 🔍 Validação Avançada de URL
  const validateEmbedUrl = useCallback(
    (url: string): ValidationResult => {
      const errors: string[] = [];
      const warnings: string[] = [];

      addLog("🔍 Validando URL...", "info");

      if (typeof url !== "string") {
        errors.push(`URL não é string (tipo: ${typeof url})`);
        return { isValid: false, errors, warnings };
      }

      if (!url || url.trim().length === 0) {
        errors.push("URL está vazia");
        return { isValid: false, errors, warnings };
      }

      if (!url.startsWith("https://")) {
        errors.push(`Protocolo inválido: ${url.substring(0, 10)}`);
      }

      try {
        const urlObj = new URL(url);
        
        if (!urlObj.hostname.includes("powerbi.com")) {
          errors.push(`Domínio inválido: ${urlObj.hostname}`);
        }

        if (urlObj.hostname !== "app.powerbi.com") {
          warnings.push(`Domínio diferente do esperado: ${urlObj.hostname}`);
        }

        if (!urlObj.pathname.includes("/reportEmbed")) {
          errors.push(`Path inválido: ${urlObj.pathname}`);
        }

        const params = new URLSearchParams(urlObj.search);
        const reportId = params.get("reportId");
        const groupId = params.get("groupId");

        if (!reportId) {
          errors.push("reportId ausente na URL");
        } else if (reportId !== dashboard.report_id) {
          errors.push(
            `reportId não corresponde: esperado ${dashboard.report_id}, recebido ${reportId}`
          );
        }

        if (!groupId) {
          warnings.push("groupId ausente na URL");
        }

        addLog(`Validação: ${errors.length} erros, ${warnings.length} avisos`, 
          errors.length > 0 ? "error" : "success");

      } catch (e) {
        errors.push(`URL malformada: ${e instanceof Error ? e.message : String(e)}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    },
    [dashboard.report_id, addLog]
  );

  // 📊 Embed Principal - COM LIMPEZA FORÇADA
  const performEmbed = useCallback(async () => {
    if (!mountedRef.current) return;

    try {
      // 🔧 PASSO 0: LIMPEZA RADICAL ANTES DE TUDO
      setPhase("cleaning");
      addLog("🧹 Executando limpeza radical antes do embed...", "info");
      await radicalCleanup();

      // Aguardar um pouco mais para garantir
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (!mountedRef.current) return;

      // Criar NOVO AbortController
      abortControllerRef.current = new AbortController();

      // PASSO 1: Validação
      setPhase("validating");
      addLog(`📋 Validando dashboard: ${dashboard.title}`, "info");

      if (!dashboard.report_id || !dashboard.dataset_id) {
        throw new Error("IDs do dashboard ausentes");
      }

      // Aguardar container
      let attempts = 0;
      while (!embedRef.current && attempts < 20) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts++;
      }

      if (!embedRef.current) {
        throw new Error("Container não inicializou");
      }

      addLog("Container disponível", "success");

      // PASSO 2: Autenticação
      setPhase("authenticating");
      addLog("🔐 Solicitando token...", "info");

      const response = await apiFetch(
        `/powerbi/embed-token/${dashboard.report_id}?datasetId=${dashboard.dataset_id}`,
        { signal: abortControllerRef.current.signal }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Falha ao obter token`);
      }

      if (!mountedRef.current) return;

      const data = await response.json();
      addLog("Token recebido", "success");

      const { token, embedUrl: rawUrl } = data;

      if (!token || typeof token !== "string" || token.length === 0) {
        throw new Error("Token inválido");
      }

      addLog(`Token válido (${token.length} chars)`, "success");

      // PASSO 3: Validar URL
      const validation = validateEmbedUrl(rawUrl);

      if (!validation.isValid) {
        throw new Error(`URL inválida:\n${validation.errors.join("\n")}`);
      }

      if (validation.warnings.length > 0) {
        validation.warnings.forEach((w) => addLog(`⚠️ ${w}`, "info"));
      }

      let embedUrl = rawUrl;
      try {
        embedUrl = decodeURIComponent(rawUrl);
      } catch (e) {
        addLog("Usando URL sem decodificação", "info");
      }

      addLog("URL validada ✅", "success");

      // PASSO 4: Conexão
      setPhase("connecting");
      addLog("🔗 Criando Power BI Service...", "info");

      if (!embedRef.current || !mountedRef.current) {
        throw new Error("Container perdido");
      }

      // 🔧 CRIAR NOVA INSTÂNCIA DO SERVICE (SEMPRE NOVA!)
      serviceRef.current = new pbi.service.Service(
        pbi.factories.hpmFactory,
        pbi.factories.wpmpFactory,
        pbi.factories.routerFactory
      );

      addLog("Service criado ✅", "success");

      // PASSO 5: Configuração
      const config: pbi.IReportEmbedConfiguration = {
        type: "report",
        id: dashboard.report_id,
        embedUrl: embedUrl,
        accessToken: token,
        tokenType: pbi.models.TokenType.Embed,
        permissions: pbi.models.Permissions.Read,
        settings: {
          filterPaneEnabled: true,
          navContentPaneEnabled: true,
          layoutType: pbi.models.LayoutType.Custom,
          customLayout: {
            displayOption: pbi.models.DisplayOption.FitToWidth,
          },
          background: pbi.models.BackgroundType.Transparent,
        },
      };

      // PASSO 6: Embed
      setPhase("loading");
      addLog("📊 Iniciando embed...", "info");

      if (!embedRef.current || !mountedRef.current) {
        throw new Error("Container removido antes do embed");
      }

      // 🔧 NÃO FAZER RESET AQUI - JÁ FIZEMOS LIMPEZA RADICAL
      // Apenas garantir que está vazio
      if (embedRef.current.children.length > 0) {
        addLog("⚠️ Container tem filhos, limpando...", "info");
        embedRef.current.innerHTML = "";
      }

      // Mostrar o container
      embedRef.current.style.display = "block";

      const report = serviceRef.current.embed(
        embedRef.current,
        config
      ) as pbi.Report;

      reportRef.current = report;
      addLog("Embed iniciado ✅", "success");

      // Event handlers
      report.on("loaded", () => {
        if (!mountedRef.current) return;
        addLog("🎉 Relatório carregado!", "success");
        setPhase("ready");
        setRetries(0);
        setError(null);
      });

      report.on("rendered", () => {
        if (!mountedRef.current) return;
        addLog("🎨 Relatório renderizado!", "success");
      });

      report.on("error", (event: any) => {
        if (!mountedRef.current) return;
        const msg = event?.detail?.message || "Erro desconhecido";
        addLog(`❌ Erro: ${msg}`, "error");
        setPhase("error");
        setError(msg);
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog("Requisição abortada", "info");
        return;
      }

      if (!mountedRef.current) return;

      const errorMsg = err?.message || "Erro desconhecido";
      addLog(`❌ ERRO: ${errorMsg}`, "error");
      setPhase("error");
      setError(errorMsg);
    }
  }, [dashboard, validateEmbedUrl, radicalCleanup, addLog]);

  // 🚀 Iniciar Carregamento
  const handleStartLoading = useCallback(async () => {
    setHasStarted(true);
    setError(null);
    setRetries(0);
    setLogs([]);
    
    addLog("🚀 Iniciando carregamento...", "success");
    
    // Executar embed
    await performEmbed();
  }, [performEmbed, addLog]);

  // 🔄 Retry
  const handleRetry = useCallback(async () => {
    if (retries >= MAX_RETRIES) {
      setError("Máximo de tentativas atingido.");
      return;
    }

    addLog(`🔄 Tentativa ${retries + 1}/${MAX_RETRIES}`, "info");
    setRetries((prev) => prev + 1);
    setError(null);
    
    await performEmbed();
  }, [retries, performEmbed, addLog]);

  // 🔄 Detectar mudança de dashboard
  useEffect(() => {
    if (currentDashboardIdRef.current !== dashboard.report_id) {
      console.log(`[PowerBI] 🔄 Dashboard mudou: ${dashboard.title}`);
      
      currentDashboardIdRef.current = dashboard.report_id;
      
      // Resetar TUDO
      setPhase("idle");
      setError(null);
      setRetries(0);
      setLogs([]);
      setHasStarted(false);
      
      // Executar limpeza radical
      radicalCleanup();
      
      addLog(`Dashboard alterado: ${dashboard.title}`, "info");
    }
  }, [dashboard.report_id, dashboard.title, radicalCleanup, addLog]);

  // 🧹 Cleanup ao desmontar
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      radicalCleanup();
    };
  }, [radicalCleanup]);

  // Fullscreen
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen error:", e);
    }
  };

  // 🎨 Phase Info
  const getPhaseInfo = () => {
    switch (phase) {
      case "idle":
        return { icon: Info, text: "Aguardando", color: "text-gray-500" };
      case "cleaning":
        return { icon: Loader2, text: "Limpando memória...", color: "text-orange-500" };
      case "validating":
        return { icon: Shield, text: "Validando dados...", color: "text-blue-500" };
      case "authenticating":
        return { icon: Server, text: "Autenticando...", color: "text-purple-500" };
      case "connecting":
        return { icon: LinkIcon, text: "Conectando...", color: "text-indigo-500" };
      case "loading":
        return { icon: Activity, text: "Carregando relatório...", color: "text-blue-600" };
      case "ready":
        return { icon: CheckCircle2, text: "Pronto", color: "text-green-600" };
      case "error":
        return { icon: AlertCircle, text: "Erro", color: "text-red-600" };
    }
  };

  const phaseInfo = getPhaseInfo();
  const PhaseIcon = phaseInfo.icon;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50"
    >
      {/* SIDEBAR DE STATUS */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shadow-lg">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-indigo-600">
          <div className="flex items-center gap-3 text-white">
            <PhaseIcon className={`w-6 h-6 ${
              phase === "loading" || 
              phase === "authenticating" || 
              phase === "validating" || 
              phase === "connecting" ||
              phase === "cleaning"
                ? "animate-spin" 
                : ""
            }`} />
            <div className="flex-1">
              <h2 className="font-bold text-lg">{dashboard.title}</h2>
              <p className="text-blue-100 text-sm">{dashboard.description}</p>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="p-6 space-y-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <PhaseIcon className={`w-5 h-5 ${phaseInfo.color}`} />
              <span className="font-semibold text-gray-900">{phaseInfo.text}</span>
            </div>

            {/* Progress Steps */}
            {phase !== "idle" && (
              <div className="space-y-2">
                {["cleaning", "validating", "authenticating", "connecting", "loading", "ready"].map(
                  (step, idx) => {
                    const isActive = phase === step;
                    const isPast =
                      ["cleaning", "validating", "authenticating", "connecting", "loading", "ready"].indexOf(
                        phase
                      ) > idx;
                    const isError = phase === "error";

                    return (
                      <div key={step} className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${
                            isError && isActive
                              ? "bg-red-500"
                              : isPast || isActive
                              ? "bg-blue-600"
                              : "bg-gray-300"
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            isActive ? "font-semibold text-gray-900" : "text-gray-600"
                          }`}
                        >
                          {step.charAt(0).toUpperCase() + step.slice(1)}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {/* Info Cards */}
          <div className="space-y-2">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <p className="text-xs font-medium text-blue-900 mb-1">Report ID</p>
              <p className="text-xs text-blue-700 font-mono break-all">
                {dashboard.report_id}
              </p>
            </div>
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-xs font-medium text-purple-900 mb-1">Dataset ID</p>
              <p className="text-xs text-purple-700 font-mono break-all">
                {dashboard.dataset_id}
              </p>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-hidden flex flex-col p-6 pt-0">
          <h3 className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
            Activity Log
          </h3>
          <div className="flex-1 bg-gray-900 rounded-lg p-3 overflow-y-auto">
            <div className="space-y-1 font-mono text-xs text-green-400">
              {logs.length === 0 ? (
                <p className="text-gray-500">Aguardando início...</p>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 border-t border-gray-200 space-y-2">
          {phase === "idle" && !hasStarted && (
            <button
              onClick={handleStartLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold shadow-md hover:shadow-lg"
            >
              <Play className="w-5 h-5" />
              Acessar Dashboard
            </button>
          )}

          {phase === "error" && retries < MAX_RETRIES && (
            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Tentar Novamente ({retries}/{MAX_RETRIES})
            </button>
          )}

          <button
            onClick={toggleFullscreen}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-4 h-4" />
                Sair Tela Cheia
              </>
            ) : (
              <>
                <Maximize2 className="w-4 h-4" />
                Tela Cheia
              </>
            )}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col">
        {/* Idle State */}
        {phase === "idle" && !hasStarted && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full text-center">
              <div className="mb-8">
                <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mb-6">
                  <Info className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  {dashboard.title}
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                  {dashboard.description}
                </p>
                <button
                  onClick={handleStartLoading}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <Play className="w-6 h-6" />
                  Acessar Dashboard
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-1">Report ID</p>
                  <p className="text-xs text-gray-900 font-mono break-all">
                    {dashboard.report_id.substring(0, 20)}...
                  </p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <p className="text-xs font-medium text-gray-600 mb-1">Dataset ID</p>
                  <p className="text-xs text-gray-900 font-mono break-all">
                    {dashboard.dataset_id.substring(0, 20)}...
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {phase === "error" && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-2xl w-full bg-white rounded-xl shadow-xl p-8 border border-red-200">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-red-100 rounded-full">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Falha ao Carregar Dashboard
                  </h3>
                  <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap break-words">
                    {error}
                  </p>
                  {retries >= MAX_RETRIES && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        <strong>Máximo de tentativas atingido.</strong>
                        <br />
                        Por favor, recarregue a página ou contate o suporte.
                      </p>
                      <button
                        onClick={() => window.location.reload()}
                        className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors text-sm font-medium"
                      >
                        Recarregar Página
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Display */}
        {phase !== "ready" && phase !== "error" && phase !== "idle" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-lg font-semibold text-gray-900">{phaseInfo.text}</p>
              <p className="text-sm text-gray-600 mt-1">Aguarde um momento...</p>
            </div>
          </div>
        )}

        {/* Embed Container */}
        <div
          ref={embedRef}
          className="flex-1 bg-white"
          style={{
            display: phase === "ready" ? "block" : "none",
          }}
        />
      </div>
    </div>
  );
}
