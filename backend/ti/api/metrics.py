from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.db import get_db
from core.utils import now_brazil_naive
from ti.services.metrics import MetricsCalculator

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics/realtime")
def get_realtime_metrics(db: Session = Depends(get_db)):
    """
    Retorna métricas instantâneas (sem cache, sem cálculos pesados).

    Endpoint consolidado para dados rápidos:
    - chamados_hoje: Quantidade de chamados abertos hoje
    - comparacao_ontem: Comparação com ontem
    - abertos_agora: Quantidade de chamados ativos
    - timestamp: Momento do cálculo
    """
    try:
        return {
            "chamados_hoje": MetricsCalculator.get_chamados_abertos_hoje(db),
            "comparacao_ontem": MetricsCalculator.get_comparacao_ontem(db),
            "abertos_agora": MetricsCalculator.get_abertos_agora(db),
            "timestamp": now_brazil_naive().isoformat(),
        }
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas em tempo real: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular métricas em tempo real: {str(e)}"
        )


@router.get("/metrics/dashboard/basic")
def get_basic_metrics(db: Session = Depends(get_db)):
    """
    [DEPRECATED] Use /metrics/realtime instead.

    Mantido por compatibilidade com código antigo.
    """
    return get_realtime_metrics(db)


@router.get("/metrics/dashboard/sla")
def get_sla_metrics(db: Session = Depends(get_db)):
    """
    Retorna métricas de SLA (carrega SEPARADO - mais lento, mas com cache).

    Retorna:
    - sla_compliance_24h: Percentual de SLA cumprido (ativos)
    - sla_compliance_mes: Percentual de SLA cumprido (todo o mês)
    - sla_distribution: Distribuição dentro/fora SLA (sincronizado com sla_compliance_mes)
    - tempo_resposta_24h: Tempo médio de primeira resposta 24h
    - tempo_resposta_mes: Tempo médio de primeira resposta mês
    - total_chamados_mes: Total de chamados deste mês
    """
    try:
        # Valida tipos esperados com exceções explícitas
        tempo_resposta_mes, total_chamados_mes = MetricsCalculator.get_tempo_medio_resposta_mes(db)
        if not isinstance(tempo_resposta_mes, str):
            raise TypeError(f"tempo_resposta_mes deve ser string, recebido: {type(tempo_resposta_mes)}")
        if not isinstance(total_chamados_mes, int):
            raise TypeError(f"total_chamados_mes deve ser int, recebido: {type(total_chamados_mes)}")

        tempo_resposta_24h = MetricsCalculator.get_tempo_medio_resposta_24h(db)
        if not isinstance(tempo_resposta_24h, str):
            raise TypeError(f"tempo_resposta_24h deve ser string, recebido: {type(tempo_resposta_24h)}")

        sla_distribution = MetricsCalculator.get_sla_distribution(db)
        if not isinstance(sla_distribution, dict):
            raise TypeError(f"sla_distribution deve ser dict, recebido: {type(sla_distribution)}")

        # Valida estrutura de sla_distribution
        required_keys = {"dentro_sla", "fora_sla", "percentual_dentro", "percentual_fora", "total"}
        if not required_keys.issubset(sla_distribution.keys()):
            raise ValueError(f"sla_distribution falta chaves: {required_keys - set(sla_distribution.keys())}")

        sla_24h = MetricsCalculator.get_sla_compliance_24h(db)
        if not isinstance(sla_24h, int):
            raise TypeError(f"sla_compliance_24h deve ser int, recebido: {type(sla_24h)}")
        if not (0 <= sla_24h <= 100):
            raise ValueError(f"sla_compliance_24h deve estar entre 0-100, recebido: {sla_24h}")

        sla_mes = MetricsCalculator.get_sla_compliance_mes(db)
        if not isinstance(sla_mes, int):
            raise TypeError(f"sla_compliance_mes deve ser int, recebido: {type(sla_mes)}")
        if not (0 <= sla_mes <= 100):
            raise ValueError(f"sla_compliance_mes deve estar entre 0-100, recebido: {sla_mes}")

        return {
            "sla_compliance_24h": sla_24h,
            "sla_compliance_mes": sla_mes,
            "sla_distribution": sla_distribution,
            "tempo_resposta_24h": tempo_resposta_24h,
            "tempo_resposta_mes": tempo_resposta_mes,
            "total_chamados_mes": total_chamados_mes,
        }
    except (TypeError, ValueError) as e:
        # Logging de erro explícito - não mascara
        print(f"[VALIDATION ERROR] Erro ao validar métricas SLA: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro no cálculo de métricas SLA: {str(e)}"
        )
    except Exception as e:
        print(f"[ERROR] Erro inesperado ao calcular métricas SLA: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular métricas SLA: {str(e)}"
        )


@router.get("/metrics/dashboard")
def get_dashboard_metrics(db: Session = Depends(get_db)):
    """
    Retorna todas as métricas do dashboard administrativo em tempo real.

    Retorna:
    - chamados_hoje: Quantidade de chamados abertos hoje
    - comparacao_ontem: Comparação com ontem (hoje, ontem, percentual, direcao)
    - tempo_resposta_24h: Tempo médio de primeira resposta nas últimas 24h
    - tempo_resposta_mes: Tempo médio de primeira resposta deste mês
    - total_chamados_mes: Total de chamados abertos neste mês
    - sla_compliance_24h: Percentual de SLA cumprido nas últimas 24h
    - abertos_agora: Quantidade de chamados com status "Aberto"
    - tempo_resolucao_30dias: Tempo médio de resolução dos últimos 30 dias
    """
    try:
        metrics = MetricsCalculator.get_dashboard_metrics(db)
        return metrics
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas: {e}")
        import traceback
        traceback.print_exc()
        return {
            "chamados_hoje": 0,
            "comparacao_ontem": {"hoje": 0, "ontem": 0, "percentual": 0, "direcao": "up"},
            "tempo_resposta_24h": "—",
            "tempo_resposta_mes": "—",
            "total_chamados_mes": 0,
            "sla_compliance_24h": 0,
            "abertos_agora": 0,
            "tempo_resolucao_30dias": "—",
        }


@router.get("/metrics/chamados-abertos")
def get_chamados_abertos(db: Session = Depends(get_db)):
    """Retorna quantidade de chamados ativos (não concluídos nem cancelados)"""
    try:
        count = MetricsCalculator.get_abertos_agora(db)
        return {"ativos": count}
    except Exception as e:
        print(f"Erro ao contar chamados ativos: {e}")
        return {"ativos": 0}


@router.get("/metrics/chamados-hoje")
def get_chamados_hoje(db: Session = Depends(get_db)):
    """Retorna quantidade de chamados abertos hoje"""
    try:
        count = MetricsCalculator.get_chamados_abertos_hoje(db)
        return {"chamados_hoje": count}
    except Exception as e:
        print(f"Erro ao contar chamados de hoje: {e}")
        return {"chamados_hoje": 0}


@router.get("/metrics/tempo-resposta")
def get_tempo_resposta(db: Session = Depends(get_db)):
    """Retorna tempo médio de resposta das últimas 24h"""
    try:
        tempo = MetricsCalculator.get_tempo_medio_resposta_24h(db)
        return {"tempo_resposta": tempo}
    except Exception as e:
        print(f"Erro ao calcular tempo de resposta: {e}")
        return {"tempo_resposta": "—"}


@router.get("/metrics/sla-compliance")
def get_sla_compliance(db: Session = Depends(get_db)):
    """Retorna percentual de SLA cumprido nas últimas 24h"""
    try:
        percentual = MetricsCalculator.get_sla_compliance_24h(db)
        return {"sla_compliance": percentual}
    except Exception as e:
        print(f"Erro ao calcular SLA compliance: {e}")
        return {"sla_compliance": 0}


@router.get("/metrics/chamados-por-dia")
def get_chamados_por_dia(dias: int = 7, db: Session = Depends(get_db)):
    """Retorna quantidade de chamados por dia dos últimos N dias"""
    try:
        dados = MetricsCalculator.get_chamados_por_dia(db, dias)
        if not isinstance(dados, list):
            return {"dados": []}
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por dia: {e}")
        import traceback
        traceback.print_exc()
        return {"dados": []}


@router.get("/metrics/chamados-por-semana")
def get_chamados_por_semana(semanas: int = 4, db: Session = Depends(get_db)):
    """Retorna quantidade de chamados por semana dos últimos N semanas"""
    try:
        dados = MetricsCalculator.get_chamados_por_semana(db, semanas)
        if not isinstance(dados, list):
            return {"dados": []}
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por semana: {e}")
        import traceback
        traceback.print_exc()
        return {"dados": []}


@router.get("/metrics/sla-distribution")
def get_sla_distribution(db: Session = Depends(get_db)):
    """Retorna distribuição de SLA (dentro/fora do acordo)"""
    try:
        dist = MetricsCalculator.get_sla_distribution(db)

        # Valida tipo esperado com exceção explícita
        if not isinstance(dist, dict):
            raise TypeError(f"sla_distribution deve retornar dict, recebido: {type(dist)}")

        # Valida estrutura obrigatória
        required_keys = {"dentro_sla", "fora_sla", "percentual_dentro", "percentual_fora", "total"}
        missing_keys = required_keys - set(dist.keys())
        if missing_keys:
            raise ValueError(f"sla_distribution falta chaves obrigatórias: {missing_keys}")

        # Valida tipos de cada campo
        if not all(isinstance(dist[k], int) for k in required_keys):
            raise TypeError(f"Todos os campos de sla_distribution devem ser int")

        # Valida ranges
        if not (0 <= dist["percentual_dentro"] <= 100):
            raise ValueError(f"percentual_dentro deve estar entre 0-100")
        if not (0 <= dist["percentual_fora"] <= 100):
            raise ValueError(f"percentual_fora deve estar entre 0-100")

        return dist

    except (TypeError, ValueError) as e:
        print(f"[VALIDATION ERROR] Erro ao validar distribuição de SLA: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular distribuição de SLA: {str(e)}"
        )
    except Exception as e:
        print(f"[ERROR] Erro inesperado ao calcular distribuição de SLA: {e}")
        import traceback
        traceback.print_exc()
        from fastapi import HTTPException
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao calcular distribuição de SLA: {str(e)}"
        )


@router.get("/metrics/performance")
def get_performance_metrics(db: Session = Depends(get_db)):
    """Retorna métricas de performance (últimos 30 dias)"""
    try:
        metricas = MetricsCalculator.get_performance_metrics(db)
        return metricas
    except Exception as e:
        print(f"Erro ao calcular métricas de performance: {e}")
        return {
            "tempo_resolucao_medio": "—",
            "primeira_resposta_media": "—",
            "taxa_reaberturas": "0%",
            "chamados_backlog": 0
        }


@router.get("/metrics/debug/tempo-resposta")
def debug_tempo_resposta(periodo: str = "mes", db: Session = Depends(get_db)):
    """
    Debug: retorna dados brutos de tempo de resposta
    periodo: "mes", "24h" ou "30dias"
    """
    try:
        historicos = MetricsCalculator.debug_tempo_resposta(db, periodo)
        return {
            "status": "ok",
            "total_registros": len(historicos),
            "periodo": periodo
        }
    except Exception as e:
        print(f"Erro ao debugar tempo de resposta: {e}")
        return {
            "status": "erro",
            "erro": str(e),
            "periodo": periodo
        }


@router.post("/metrics/debug/recalculate-sla")
def debug_recalculate_sla(db: Session = Depends(get_db)):
    """
    Debug: força recálculo de todas as métricas de SLA
    Útil para verificar se há problemas nos cálculos
    """
    try:
        from ti.services.sla_cache import SLACacheManager
        from core.utils import now_brazil_naive

        # Invalida todos os caches
        SLACacheManager.invalidate_all_sla(db)

        # Recalcula
        sla_24h = MetricsCalculator.get_sla_compliance_24h(db)
        sla_mes = MetricsCalculator.get_sla_compliance_mes(db)
        sla_dist = MetricsCalculator.get_sla_distribution(db)

        return {
            "status": "ok",
            "sla_compliance_24h": sla_24h,
            "sla_compliance_mes": sla_mes,
            "sla_distribution": sla_dist,
            "timestamp": now_brazil_naive().isoformat()
        }
    except Exception as e:
        print(f"Erro ao recalcular SLA: {e}")
        import traceback
        traceback.print_exc()
        return {
            "status": "erro",
            "erro": str(e)
        }
