from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from ti.models.chamado import Chamado
from ti.models.historico_status import HistoricoStatus
from ti.models.sla_config import HistoricoSLA, SLAConfiguration
from core.utils import now_brazil_naive


class MetricsCalculator:
    """Calcula métricas do dashboard em tempo real"""

    @staticmethod
    def get_chamados_abertos_hoje(db: Session) -> int:
        """Retorna quantidade de chamados abertos hoje"""
        hoje = now_brazil_naive().replace(hour=0, minute=0, second=0, microsecond=0)
        
        count = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= hoje,
                Chamado.status != "Cancelado"
            )
        ).count()
        
        return count

    @staticmethod
    def get_abertos_agora(db: Session) -> int:
        """
        Retorna quantidade de chamados ATIVOS (não concluídos nem cancelados).
        Equivalente a "todos" na página de gerenciar chamados.
        """
        count = db.query(Chamado).filter(
            and_(
                Chamado.status != "Concluído",
                Chamado.status != "Cancelado"
            )
        ).count()

        return count

    @staticmethod
    def get_tempo_medio_resposta_24h(db: Session) -> str:
        """Calcula tempo médio de resposta das últimas 24h"""
        agora = now_brazil_naive()
        ontem = agora - timedelta(hours=24)
        
        chamados = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= ontem,
                Chamado.data_primeira_resposta.isnot(None),
            )
        ).all()
        
        if not chamados:
            return "—"
        
        tempos = []
        for chamado in chamados:
            if chamado.data_primeira_resposta and chamado.data_abertura:
                delta = chamado.data_primeira_resposta - chamado.data_abertura
                horas = delta.total_seconds() / 3600
                tempos.append(horas)
        
        if not tempos:
            return "—"
        
        media_horas = sum(tempos) / len(tempos)
        
        if media_horas < 1:
            minutos = int(media_horas * 60)
            return f"{minutos}m"
        else:
            horas = int(media_horas)
            minutos = int((media_horas - horas) * 60)
            return f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h"

    @staticmethod
    def get_sla_compliance_24h(db: Session) -> int:
        """Calcula percentual de SLA cumprido nas últimas 24h"""
        agora = now_brazil_naive()
        ontem = agora - timedelta(hours=24)
        
        historicos = db.query(HistoricoSLA).filter(
            HistoricoSLA.criado_em >= ontem
        ).all()
        
        if not historicos:
            return 0
        
        em_dia = sum(1 for h in historicos if h.status_sla == "ok")
        percentual = int((em_dia / len(historicos)) * 100)
        
        return percentual

    @staticmethod
    def get_chamados_hoje_count(db: Session) -> int:
        """Retorna quantidade de chamados de hoje"""
        return MetricsCalculator.get_chamados_abertos_hoje(db)

    @staticmethod
    def get_comparacao_ontem(db: Session) -> dict:
        """Compara chamados de hoje vs ontem"""
        agora = now_brazil_naive()
        hoje_inicio = agora.replace(hour=0, minute=0, second=0, microsecond=0)
        ontem_inicio = (agora - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        ontem_fim = hoje_inicio
        
        chamados_hoje = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= hoje_inicio,
                Chamado.status != "Cancelado"
            )
        ).count()
        
        chamados_ontem = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= ontem_inicio,
                Chamado.data_abertura < ontem_fim,
                Chamado.status != "Cancelado"
            )
        ).count()
        
        if chamados_ontem == 0:
            percentual = 0
        else:
            percentual = int(((chamados_hoje - chamados_ontem) / chamados_ontem) * 100)
        
        return {
            "hoje": chamados_hoje,
            "ontem": chamados_ontem,
            "percentual": percentual,
            "direcao": "up" if percentual >= 0 else "down"
        }

    @staticmethod
    def get_tempo_resolucao_media_30dias(db: Session) -> str:
        """Calcula tempo médio de resolução dos últimos 30 dias"""
        agora = now_brazil_naive()
        trinta_dias_atras = agora - timedelta(days=30)
        
        chamados = db.query(Chamado).filter(
            and_(
                Chamado.data_abertura >= trinta_dias_atras,
                Chamado.data_conclusao.isnot(None),
            )
        ).all()
        
        if not chamados:
            return "—"
        
        tempos = []
        for chamado in chamados:
            if chamado.data_conclusao and chamado.data_abertura:
                delta = chamado.data_conclusao - chamado.data_abertura
                horas = delta.total_seconds() / 3600
                tempos.append(horas)
        
        if not tempos:
            return "—"
        
        media_horas = sum(tempos) / len(tempos)
        
        horas = int(media_horas)
        minutos = int((media_horas - horas) * 60)
        return f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h"

    @staticmethod
    def get_dashboard_metrics(db: Session) -> dict:
        """Retorna todos os métricas do dashboard"""
        return {
            "chamados_hoje": MetricsCalculator.get_chamados_abertos_hoje(db),
            "comparacao_ontem": MetricsCalculator.get_comparacao_ontem(db),
            "tempo_resposta_24h": MetricsCalculator.get_tempo_medio_resposta_24h(db),
            "sla_compliance_24h": MetricsCalculator.get_sla_compliance_24h(db),
            "abertos_agora": MetricsCalculator.get_abertos_agora(db),
            "tempo_resolucao_30dias": MetricsCalculator.get_tempo_resolucao_media_30dias(db),
        }
