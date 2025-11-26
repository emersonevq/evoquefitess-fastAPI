from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from core.db import get_db
from ti.services.metrics import MetricsCalculator

router = APIRouter(prefix="/api", tags=["metrics"])


@router.get("/metrics/dashboard/basic")
def get_basic_metrics(db: Session = Depends(get_db)):
    """
    Retorna métricas RÁPIDAS (carrega primeiro - quase instantâneo).

    Retorna:
    - chamados_hoje: Quantidade de chamados abertos hoje
    - comparacao_ontem: Comparação com ontem
    - abertos_agora: Quantidade de chamados ativos
    """
    try:
        return {
            "chamados_hoje": MetricsCalculator.get_chamados_abertos_hoje(db),
            "comparacao_ontem": MetricsCalculator.get_comparacao_ontem(db),
            "abertos_agora": MetricsCalculator.get_abertos_agora(db),
        }
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas básicas: {e}")
        return {
            "chamados_hoje": 0,
            "comparacao_ontem": {"hoje": 0, "ontem": 0, "percentual": 0, "direcao": "up"},
            "abertos_agora": 0,
        }


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
        tempo_resposta_mes, total_chamados_mes = MetricsCalculator.get_tempo_medio_resposta_mes(db)
        tempo_resposta_24h = MetricsCalculator.get_tempo_medio_resposta_24h(db)
        sla_distribution = MetricsCalculator.get_sla_distribution(db)

        return {
            "sla_compliance_24h": MetricsCalculator.get_sla_compliance_24h(db),
            "sla_compliance_mes": MetricsCalculator.get_sla_compliance_mes(db),
            "sla_distribution": sla_distribution,
            "tempo_resposta_24h": tempo_resposta_24h,
            "tempo_resposta_mes": tempo_resposta_mes,
            "total_chamados_mes": total_chamados_mes,
        }
    except Exception as e:
        print(f"[ERROR] Erro ao calcular métricas SLA: {e}")
        return {
            "sla_compliance_24h": 0,
            "sla_compliance_mes": 0,
            "sla_distribution": {
                "dentro_sla": 0,
                "fora_sla": 0,
                "percentual_dentro": 0,
                "percentual_fora": 0,
                "total": 0
            },
            "tempo_resposta_24h": "—",
            "tempo_resposta_mes": "—",
            "total_chamados_mes": 0,
        }


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
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por dia: {e}")
        return {"dados": []}


@router.get("/metrics/chamados-por-semana")
def get_chamados_por_semana(semanas: int = 4, db: Session = Depends(get_db)):
    """Retorna quantidade de chamados por semana dos últimos N semanas"""
    try:
        dados = MetricsCalculator.get_chamados_por_semana(db, semanas)
        return {"dados": dados}
    except Exception as e:
        print(f"Erro ao calcular chamados por semana: {e}")
        return {"dados": []}


@router.get("/metrics/sla-distribution")
def get_sla_distribution(db: Session = Depends(get_db)):
    """Retorna distribuição de SLA (dentro/fora do acordo)"""
    try:
        dist = MetricsCalculator.get_sla_distribution(db)
        return dist
    except Exception as e:
        print(f"Erro ao calcular distribuição de SLA: {e}")
        return {
            "dentro_sla": 0,
            "fora_sla": 0,
            "percentual_dentro": 0,
            "percentual_fora": 0,
            "total": 0
        }


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
