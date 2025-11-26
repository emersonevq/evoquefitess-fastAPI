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
        """Calcula tempo médio de PRIMEIRA resposta das últimas 24h"""
        agora = now_brazil_naive()
        ontem = agora - timedelta(hours=24)

        try:
            # Subquery para pegar apenas a PRIMEIRA resposta por chamado nas últimas 24h
            subquery = db.query(
                HistoricoStatus.chamado_id,
                func.min(HistoricoStatus.created_at).label('primeira_resposta_at')
            ).filter(
                and_(
                    HistoricoStatus.created_at >= ontem,
                    HistoricoStatus.status.in_(["Em Atendimento", "Em análise", "Em andamento"])
                )
            ).group_by(HistoricoStatus.chamado_id).subquery()

            # Busca os históricos da primeira resposta + dados do chamado (JOIN direto)
            resultados = db.query(
                HistoricoStatus.data_inicio,
                Chamado.data_abertura
            ).join(
                subquery,
                and_(
                    HistoricoStatus.chamado_id == subquery.c.chamado_id,
                    HistoricoStatus.created_at == subquery.c.primeira_resposta_at
                )
            ).join(
                Chamado,
                Chamado.id == HistoricoStatus.chamado_id
            ).all()

            if not resultados:
                return "—"

            # Calcula os tempos
            tempos = []
            for data_inicio, data_abertura in resultados:
                if data_inicio and data_abertura:
                    delta = data_inicio - data_abertura
                    horas = delta.total_seconds() / 3600
                    # Filtro de sanidade: apenas valores entre 0 e 72h
                    if 0 <= horas <= 72:
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
        except Exception as e:
            print(f"Erro ao calcular tempo de resposta: {e}")
            import traceback
            traceback.print_exc()
            return "—"

    @staticmethod
    def get_tempo_medio_resposta_mes(db: Session) -> tuple[str, int]:
        """Calcula tempo médio de PRIMEIRA resposta deste mês usando Chamado.data_primeira_resposta"""
        agora = now_brazil_naive()
        mes_inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        try:
            # Busca chamados do mês que já tiveram primeira resposta
            chamados = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= mes_inicio,
                    Chamado.data_abertura <= agora,
                    Chamado.status != "Cancelado",
                    Chamado.data_primeira_resposta.isnot(None)
                )
            ).all()

            # Conta total de chamados do mês (mesmo sem resposta)
            total_chamados_mes = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= mes_inicio,
                    Chamado.data_abertura <= agora,
                    Chamado.status != "Cancelado"
                )
            ).count()

            if not chamados:
                return "—", total_chamados_mes

            # Calcula os tempos
            tempos = []
            for chamado in chamados:
                if chamado.data_primeira_resposta and chamado.data_abertura:
                    delta = chamado.data_primeira_resposta - chamado.data_abertura
                    horas = delta.total_seconds() / 3600

                    # Filtro de sanidade: apenas valores entre 0 e 24h
                    if 0 <= horas <= 24:
                        tempos.append(horas)

            if not tempos:
                return "—", total_chamados_mes

            media_horas = sum(tempos) / len(tempos)

            # Formata o resultado
            if media_horas < 1:
                return f"{int(media_horas * 60)}m", total_chamados_mes
            else:
                horas = int(media_horas)
                minutos = int((media_horas - horas) * 60)
                return (f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h"), total_chamados_mes

        except Exception as e:
            print(f"Erro ao calcular tempo de resposta do mês: {e}")
            import traceback
            traceback.print_exc()
            return "—", 0

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
    def get_chamados_por_dia(db: Session, dias: int = 7) -> list[dict]:
        """Retorna quantidade de chamados por dia dos últimos N dias"""
        agora = now_brazil_naive()
        dias_atras = agora - timedelta(days=dias)

        dias_data = []
        for i in range(dias):
            dia = agora - timedelta(days=dias - 1 - i)
            dias_data.append(dia.replace(hour=0, minute=0, second=0, microsecond=0))

        resultado = []
        for i, dia_inicio in enumerate(dias_data):
            dia_fim = dia_inicio + timedelta(days=1)

            count = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= dia_inicio,
                    Chamado.data_abertura < dia_fim,
                    Chamado.status != "Cancelado"
                )
            ).count()

            dia_nome = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][dia_inicio.weekday()]
            resultado.append({
                "dia": dia_nome,
                "data": dia_inicio.strftime("%Y-%m-%d"),
                "quantidade": count
            })

        return resultado

    @staticmethod
    def get_chamados_por_semana(db: Session, semanas: int = 4) -> list[dict]:
        """Retorna quantidade de chamados por semana dos últimos N semanas"""
        agora = now_brazil_naive()
        resultado = []

        for i in range(semanas):
            semana_num = semanas - i
            semana_inicio = agora - timedelta(weeks=i)
            semana_inicio = semana_inicio - timedelta(days=semana_inicio.weekday())
            semana_inicio = semana_inicio.replace(hour=0, minute=0, second=0, microsecond=0)
            semana_fim = semana_inicio + timedelta(days=7)

            count = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= semana_inicio,
                    Chamado.data_abertura < semana_fim,
                    Chamado.status != "Cancelado"
                )
            ).count()

            resultado.insert(0, {
                "semana": f"S{semana_num}",
                "quantidade": count
            })

        return resultado

    @staticmethod
    def get_sla_distribution(db: Session) -> dict:
        """Retorna distribuição de SLA (dentro/fora)"""
        from ti.services.sla import SLACalculator

        chamados_ativos = db.query(Chamado).filter(
            and_(
                Chamado.status != "Concluído",
                Chamado.status != "Cancelado"
            )
        ).all()

        dentro_sla = 0
        fora_sla = 0

        for chamado in chamados_ativos:
            sla_status = SLACalculator.get_sla_status(db, chamado)
            if sla_status.get("tempo_resolucao_status") == "ok":
                dentro_sla += 1
            elif sla_status.get("tempo_resolucao_status") == "vencido":
                fora_sla += 1

        total = dentro_sla + fora_sla
        if total == 0:
            return {
                "dentro_sla": 0,
                "fora_sla": 0,
                "percentual_dentro": 0,
                "percentual_fora": 0,
                "total": 0
            }

        percentual_dentro = int((dentro_sla / total) * 100)
        percentual_fora = int((fora_sla / total) * 100)

        return {
            "dentro_sla": dentro_sla,
            "fora_sla": fora_sla,
            "percentual_dentro": percentual_dentro,
            "percentual_fora": percentual_fora,
            "total": total
        }

    @staticmethod
    def get_performance_metrics(db: Session) -> dict:
        """Retorna métricas de performance (últimos 30 dias)"""
        agora = now_brazil_naive()
        trinta_dias_atras = agora - timedelta(days=30)

        chamados_30dias = db.query(Chamado).filter(
            Chamado.data_abertura >= trinta_dias_atras
        ).all()

        # Tempo médio de resolução
        tempos_resolucao = []
        for chamado in chamados_30dias:
            if chamado.data_conclusao and chamado.data_abertura:
                delta = chamado.data_conclusao - chamado.data_abertura
                horas = delta.total_seconds() / 3600
                tempos_resolucao.append(horas)

        tempo_resolucao_medio = sum(tempos_resolucao) / len(tempos_resolucao) if tempos_resolucao else 0
        horas = int(tempo_resolucao_medio)
        minutos = int((tempo_resolucao_medio - horas) * 60)
        tempo_resolucao_str = f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h" if horas > 0 else "—"

        # Tempo médio de PRIMEIRA resposta usando historico_status
        tempos_primeira_resposta = []

        # Subquery: pega apenas a PRIMEIRA mudança de status por chamado nos últimos 30 dias
        subquery = db.query(
            HistoricoStatus.chamado_id,
            func.min(HistoricoStatus.created_at).label('primeira_resposta_at')
        ).filter(
            and_(
                HistoricoStatus.created_at >= trinta_dias_atras,
                HistoricoStatus.status.in_(["Em Atendimento", "Em análise", "Em andamento"])
            )
        ).group_by(HistoricoStatus.chamado_id).subquery()

        # Busca os históricos da primeira resposta + dados do chamado (JOIN direto)
        resultados = db.query(
            HistoricoStatus.data_inicio,
            Chamado.data_abertura
        ).join(
            subquery,
            and_(
                HistoricoStatus.chamado_id == subquery.c.chamado_id,
                HistoricoStatus.created_at == subquery.c.primeira_resposta_at
            )
        ).join(
            Chamado,
            Chamado.id == HistoricoStatus.chamado_id
        ).all()

        for data_inicio, data_abertura in resultados:
            if data_inicio and data_abertura:
                delta = data_inicio - data_abertura
                minutos_delta = delta.total_seconds() / 60
                # Filtro de sanidade: máximo 72h (4320 minutos)
                if 0 <= minutos_delta <= 4320:
                    tempos_primeira_resposta.append(minutos_delta)

        tempo_primeira_resposta_medio = sum(tempos_primeira_resposta) / len(tempos_primeira_resposta) if tempos_primeira_resposta else 0
        tempo_primeira_resposta_str = f"{int(tempo_primeira_resposta_medio)}m" if tempo_primeira_resposta_medio > 0 else "—"

        # Taxa de reaberturas
        chamados_reabertos = sum(1 for c in chamados_30dias if c.reaberto and c.numero_reaberturas and c.numero_reaberturas > 0)
        taxa_reaberturas = int((chamados_reabertos / len(chamados_30dias)) * 100) if chamados_30dias else 0

        # Chamados em backlog (status Aguardando ou Em análise ou Aberto)
        chamados_backlog = db.query(Chamado).filter(
            Chamado.status.in_(["Aguardando", "Em análise", "Aberto"])
        ).count()

        return {
            "tempo_resolucao_medio": tempo_resolucao_str,
            "primeira_resposta_media": tempo_primeira_resposta_str,
            "taxa_reaberturas": f"{taxa_reaberturas}%",
            "chamados_backlog": chamados_backlog
        }

    @staticmethod
    def debug_tempo_resposta(db: Session, periodo: str = "mes"):
        """
        Debug: mostra os dados brutos de tempo de resposta
        periodo: "mes", "24h" ou "30dias"
        """
        agora = now_brazil_naive()

        if periodo == "mes":
            inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif periodo == "24h":
            inicio = agora - timedelta(hours=24)
        else:  # 30dias
            inicio = agora - timedelta(days=30)

        historicos = db.query(HistoricoStatus).filter(
            and_(
                HistoricoStatus.created_at >= inicio,
                HistoricoStatus.status.in_(["Em Atendimento", "Em análise", "Em andamento"])
            )
        ).all()

        print(f"\n{'='*100}")
        print(f"DEBUG: Tempo de Resposta ({periodo})")
        print(f"Período: {inicio.strftime('%Y-%m-%d %H:%M:%S')} a {agora.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Total de registros encontrados: {len(historicos)}")
        print(f"{'='*100}")

        # Agrupa por chamado_id para mostrar quantos registros por chamado
        from collections import Counter
        chamado_counts = Counter(h.chamado_id for h in historicos)
        print(f"\nTotal de chamados únicos: {len(chamado_counts)}")
        duplicados = {k: v for k, v in chamado_counts.items() if v > 1}
        print(f"Chamados com múltiplos registros: {len(duplicados)}")

        if duplicados:
            print(f"\nExemplos de chamados com duplicatas:")
            for chamado_id, count in list(duplicados.items())[:5]:
                print(f"  - Chamado #{chamado_id}: {count} registros")

        print(f"\n{'─'*100}")
        print(f"{'Chamado':>8} | {'Aberto':>19} | {'Status':>15} | {'Resposta':>19} | {'Delta (horas)':>14} | {'Validado?':>10}")
        print(f"{'─'*100}")

        # Mostra exemplos detalhados
        for h in historicos[:15]:  # Primeiros 15
            chamado = db.query(Chamado).filter(Chamado.id == h.chamado_id).first()
            if chamado:
                delta = h.data_inicio - chamado.data_abertura if h.data_inicio else None
                horas = delta.total_seconds() / 3600 if delta else 0
                validado = "✓" if (0 <= horas <= 72) else "✗"
                print(f"{h.chamado_id:>8} | {str(chamado.data_abertura):>19} | {h.status:>15} | "
                      f"{str(h.data_inicio):>19} | {horas:>14.1f} | {validado:>10}")

        if len(historicos) > 15:
            print(f"{'─'*100}")
            print(f"... e mais {len(historicos) - 15} registros")

        print(f"{'='*100}\n")

        return historicos

    @staticmethod
    def get_dashboard_metrics(db: Session) -> dict:
        """Retorna todos os métricas do dashboard"""
        tempo_resposta_mes, total_chamados_mes = MetricsCalculator.get_tempo_medio_resposta_mes(db)

        return {
            "chamados_hoje": MetricsCalculator.get_chamados_abertos_hoje(db),
            "comparacao_ontem": MetricsCalculator.get_comparacao_ontem(db),
            "tempo_resposta_24h": MetricsCalculator.get_tempo_medio_resposta_24h(db),
            "tempo_resposta_mes": tempo_resposta_mes,
            "total_chamados_mes": total_chamados_mes,
            "sla_compliance_24h": MetricsCalculator.get_sla_compliance_24h(db),
            "abertos_agora": MetricsCalculator.get_abertos_agora(db),
            "tempo_resolucao_30dias": MetricsCalculator.get_tempo_resolucao_media_30dias(db),
        }
