from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from ti.models.chamado import Chamado
from ti.models.historico_status import HistoricoStatus
from ti.models.sla_config import HistoricoSLA, SLAConfiguration
from ti.models.metrics_cache import MetricsCacheDB, SLACalculationLog
from core.utils import now_brazil_naive
import threading
import time


class MetricsCache:
    """Cache em memória para métricas pesadas com TTL aumentado para 10 minutos"""
    _cache = {}
    _lock = threading.Lock()
    _ttl_seconds = 600  # 10 minutos ao invés de 30 segundos

    @classmethod
    def get(cls, key: str):
        """Obtém valor do cache se ainda estiver válido"""
        with cls._lock:
            if key in cls._cache:
                value, timestamp = cls._cache[key]
                age = (datetime.now() - timestamp).total_seconds()
                if age < cls._ttl_seconds:
                    return value
                else:
                    del cls._cache[key]
        return None

    @classmethod
    def set(cls, key: str, value):
        """Armazena valor no cache com timestamp"""
        with cls._lock:
            cls._cache[key] = (value, datetime.now())

    @classmethod
    def clear(cls, key: str = None):
        """Limpa cache (específico ou tudo)"""
        with cls._lock:
            if key:
                cls._cache.pop(key, None)
            else:
                cls._cache.clear()


class PersistentMetricsCache:
    """Cache persistente no banco de dados para sobreviver restarts"""
    
    @staticmethod
    def get(db: Session, key: str):
        """Obtém valor do cache persistente se ainda estiver válido"""
        try:
            cache_entry = db.query(MetricsCacheDB).filter(
                MetricsCacheDB.cache_key == key
            ).first()
            
            if cache_entry and not cache_entry.is_expired():
                return cache_entry.cache_value
            elif cache_entry:
                db.delete(cache_entry)
                db.commit()
        except Exception as e:
            print(f"Erro ao ler cache persistente {key}: {e}")
        
        return None

    @staticmethod
    def set(db: Session, key: str, value: dict, ttl_minutes: int = 10):
        """Armazena valor no cache persistente"""
        try:
            now = datetime.utcnow()
            expires_at = now + timedelta(minutes=ttl_minutes)
            
            cache_entry = db.query(MetricsCacheDB).filter(
                MetricsCacheDB.cache_key == key
            ).first()
            
            if cache_entry:
                cache_entry.cache_value = value
                cache_entry.calculated_at = now
                cache_entry.expires_at = expires_at
            else:
                cache_entry = MetricsCacheDB(
                    cache_key=key,
                    cache_value=value,
                    calculated_at=now,
                    expires_at=expires_at
                )
                db.add(cache_entry)
            
            db.commit()
        except Exception as e:
            print(f"Erro ao salvar cache persistente {key}: {e}")
            db.rollback()

    @staticmethod
    def clear(db: Session, key: str = None):
        """Limpa cache persistente"""
        try:
            if key:
                db.query(MetricsCacheDB).filter(MetricsCacheDB.cache_key == key).delete()
            else:
                db.query(MetricsCacheDB).delete()
            db.commit()
        except Exception as e:
            print(f"Erro ao limpar cache persistente: {e}")
            db.rollback()


class MetricsCalculator:
    """Calcula métricas do dashboard em tempo real com otimizações de cache e incrementalidade"""

    @staticmethod
    def get_chamados_abertos_hoje(db: Session) -> int:
        """Retorna quantidade de chamados abertos hoje"""
        try:
            hoje = now_brazil_naive().replace(hour=0, minute=0, second=0, microsecond=0)

            count = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= hoje,
                    Chamado.status != "Cancelado"
                )
            ).count()

            return count
        except Exception as e:
            print(f"Erro ao contar chamados de hoje: {e}")
            import traceback
            traceback.print_exc()
            return 0

    @staticmethod
    def get_abertos_agora(db: Session) -> int:
        """
        Retorna quantidade de chamados ATIVOS (não concluídos nem cancelados).
        Equivalente a "todos" na página de gerenciar chamados.
        """
        try:
            count = db.query(Chamado).filter(
                and_(
                    Chamado.status != "Concluído",
                    Chamado.status != "Cancelado"
                )
            ).count()

            return count
        except Exception as e:
            print(f"Erro ao contar chamados ativos: {e}")
            import traceback
            traceback.print_exc()
            return 0

    @staticmethod
    def get_tempo_medio_resposta_24h(db: Session) -> str:
        """Calcula tempo médio de PRIMEIRA resposta das últimas 24h em horas de negócio - OTIMIZADO"""
        from ti.services.sla import SLACalculator
        from ti.models.sla_config import SLABusinessHours

        agora = now_brazil_naive()
        ontem = agora - timedelta(hours=24)

        try:
            chamados = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= ontem,
                    Chamado.status != "Cancelado",
                    Chamado.data_primeira_resposta.isnot(None),
                    Chamado.data_primeira_resposta >= ontem
                )
            ).all()

            if not chamados:
                return "—"

            # PRÉ-CARREGAR business hours de uma vez
            business_hours_cache = {}
            for weekday in range(5):
                bh_result = db.query(SLABusinessHours).filter(
                    and_(
                        SLABusinessHours.dia_semana == weekday,
                        SLABusinessHours.ativo == True
                    )
                ).first()
                if bh_result:
                    business_hours_cache[weekday] = (bh_result.hora_inicio, bh_result.hora_fim)
                else:
                    business_hours_cache[weekday] = SLACalculator.DEFAULT_BUSINESS_HOURS.get(weekday)

            tempos = []
            for chamado in chamados:
                if chamado.data_primeira_resposta and chamado.data_abertura:
                    horas = SLACalculator.calculate_business_hours(
                        chamado.data_abertura,
                        chamado.data_primeira_resposta,
                        db,
                        business_hours_cache
                    )
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
            print(f"Erro ao calcular tempo de resposta 24h: {e}")
            import traceback
            traceback.print_exc()
            return "—"

    @staticmethod
    def get_tempo_medio_resposta_mes(db: Session) -> tuple[str, int]:
        """Calcula tempo médio de PRIMEIRA resposta deste mês usando Chamado.data_primeira_resposta - OTIMIZADO"""
        from ti.services.sla import SLACalculator
        from ti.models.sla_config import SLABusinessHours

        agora = now_brazil_naive()
        mes_inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        try:
            chamados = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= mes_inicio,
                    Chamado.data_abertura <= agora,
                    Chamado.status != "Cancelado",
                    Chamado.data_primeira_resposta.isnot(None)
                )
            ).all()

            total_chamados_mes = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= mes_inicio,
                    Chamado.data_abertura <= agora,
                    Chamado.status != "Cancelado"
                )
            ).count()

            if not chamados:
                return "—", total_chamados_mes

            # PRÉ-CARREGAR business hours de uma vez
            business_hours_cache = {}
            for weekday in range(5):
                bh_result = db.query(SLABusinessHours).filter(
                    and_(
                        SLABusinessHours.dia_semana == weekday,
                        SLABusinessHours.ativo == True
                    )
                ).first()
                if bh_result:
                    business_hours_cache[weekday] = (bh_result.hora_inicio, bh_result.hora_fim)
                else:
                    business_hours_cache[weekday] = SLACalculator.DEFAULT_BUSINESS_HOURS.get(weekday)

            tempos = []
            for chamado in chamados:
                if chamado.data_primeira_resposta and chamado.data_abertura:
                    horas = SLACalculator.calculate_business_hours(
                        chamado.data_abertura,
                        chamado.data_primeira_resposta,
                        db,
                        business_hours_cache
                    )

                    if 0 <= horas <= 72:
                        tempos.append(horas)

            if not tempos:
                return "—", total_chamados_mes

            media_horas = sum(tempos) / len(tempos)

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
        """Calcula percentual de SLA cumprido (baseado em chamados ativos) - OTIMIZADO com cache persistente"""
        # Tenta cache em memória primeiro
        cached = MetricsCache.get("sla_compliance_24h")
        if cached is not None:
            return cached

        # Tenta cache persistente
        cached_persistent = PersistentMetricsCache.get(db, "sla_compliance_24h")
        if cached_persistent is not None:
            result = cached_persistent.get("value", 0)
            MetricsCache.set("sla_compliance_24h", result)
            return result

        # Se não houver cache, calcula
        result = MetricsCalculator._calculate_sla_compliance_24h(db)
        MetricsCache.set("sla_compliance_24h", result)
        PersistentMetricsCache.set(db, "sla_compliance_24h", {"value": result}, ttl_minutes=10)
        return result

    @staticmethod
    def _calculate_sla_compliance_24h(db: Session) -> int:
        """Cálculo real de SLA 24h - otimizado sem N+1 e com cache de business hours"""
        start_time = time.time()
        try:
            from ti.services.sla import SLACalculator
            from ti.models.historico_status import HistoricoStatus
            from ti.models.sla_config import SLABusinessHours

            sla_configs = {
                config.prioridade: config
                for config in db.query(SLAConfiguration).filter(
                    SLAConfiguration.ativo == True
                ).all()
            }

            if not sla_configs:
                return 0

            # PRÉ-CARREGAR business hours de uma vez (evita queries em loop)
            business_hours_cache = {}
            for weekday in range(5):
                bh_result = db.query(SLABusinessHours).filter(
                    and_(
                        SLABusinessHours.dia_semana == weekday,
                        SLABusinessHours.ativo == True
                    )
                ).first()
                if bh_result:
                    business_hours_cache[weekday] = (bh_result.hora_inicio, bh_result.hora_fim)
                else:
                    business_hours_cache[weekday] = SLACalculator.DEFAULT_BUSINESS_HOURS.get(weekday)

            chamados_ativos = db.query(Chamado).filter(
                and_(
                    Chamado.status.notin_(["Concluído", "Concluido", "Cancelado"])
                )
            ).all()

            if not chamados_ativos:
                return 0

            chamado_ids = [c.id for c in chamados_ativos]
            historicos_bulk = db.query(HistoricoStatus).filter(
                HistoricoStatus.chamado_id.in_(chamado_ids)
            ).all()

            historicos_cache = {}
            for hist in historicos_bulk:
                if hist.chamado_id not in historicos_cache:
                    historicos_cache[hist.chamado_id] = []
                historicos_cache[hist.chamado_id].append(hist)

            dentro_sla = 0
            fora_sla = 0
            agora = now_brazil_naive()

            for chamado in chamados_ativos:
                try:
                    sla_config = sla_configs.get(chamado.prioridade)
                    if not sla_config:
                        continue

                    data_final = chamado.data_conclusao if chamado.data_conclusao else agora
                    tempo_decorrido = SLACalculator.calculate_business_hours_excluding_paused(
                        chamado.id,
                        chamado.data_abertura,
                        data_final,
                        db,
                        historicos_cache,
                        business_hours_cache
                    )

                    if tempo_decorrido <= sla_config.tempo_resolucao_horas:
                        dentro_sla += 1
                    else:
                        fora_sla += 1

                except Exception as e:
                    print(f"Erro ao processar chamado {chamado.id}: {e}")
                    continue

            total = dentro_sla + fora_sla
            if total == 0:
                return 0

            result = int((dentro_sla / total) * 100)
            
            # Log de execução
            execution_time = (time.time() - start_time) * 1000
            MetricsCalculator._log_calculation(db, "24h", len(chamados_ativos), execution_time)
            
            return result

        except Exception as e:
            print(f"Erro ao calcular SLA compliance 24h: {e}")
            import traceback
            traceback.print_exc()
            return 0

    @staticmethod
    def get_sla_compliance_mes(db: Session) -> int:
        """Calcula percentual de SLA cumprido para todos os chamados do mês - OTIMIZADO com cache persistente"""
        cached = MetricsCache.get("sla_compliance_mes")
        if cached is not None:
            return cached

        cached_persistent = PersistentMetricsCache.get(db, "sla_compliance_mes")
        if cached_persistent is not None:
            result = cached_persistent.get("value", 0)
            MetricsCache.set("sla_compliance_mes", result)
            return result

        result = MetricsCalculator._calculate_sla_compliance_mes(db)
        MetricsCache.set("sla_compliance_mes", result)
        PersistentMetricsCache.set(db, "sla_compliance_mes", {"value": result}, ttl_minutes=10)
        return result

    @staticmethod
    def _calculate_sla_compliance_mes(db: Session) -> int:
        """Cálculo real de SLA mensal - otimizado sem N+1 e com cache de business hours"""
        start_time = time.time()
        try:
            from ti.services.sla import SLACalculator
            from ti.models.historico_status import HistoricoStatus
            from ti.models.sla_config import SLABusinessHours

            agora = now_brazil_naive()
            mes_inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            sla_configs = {
                config.prioridade: config
                for config in db.query(SLAConfiguration).filter(
                    SLAConfiguration.ativo == True
                ).all()
            }

            if not sla_configs:
                return 0

            # PRÉ-CARREGAR business hours de uma vez (evita queries em loop)
            business_hours_cache = {}
            for weekday in range(5):
                bh_result = db.query(SLABusinessHours).filter(
                    and_(
                        SLABusinessHours.dia_semana == weekday,
                        SLABusinessHours.ativo == True
                    )
                ).first()
                if bh_result:
                    business_hours_cache[weekday] = (bh_result.hora_inicio, bh_result.hora_fim)
                else:
                    business_hours_cache[weekday] = SLACalculator.DEFAULT_BUSINESS_HOURS.get(weekday)

            chamados_mes = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= mes_inicio,
                    Chamado.data_abertura <= agora,
                    Chamado.status != "Cancelado",
                    Chamado.data_primeira_resposta.isnot(None)
                )
            ).all()

            if not chamados_mes:
                return 0

            chamado_ids = [c.id for c in chamados_mes]
            historicos_bulk = db.query(HistoricoStatus).filter(
                HistoricoStatus.chamado_id.in_(chamado_ids)
            ).all()

            historicos_cache = {}
            for hist in historicos_bulk:
                if hist.chamado_id not in historicos_cache:
                    historicos_cache[hist.chamado_id] = []
                historicos_cache[hist.chamado_id].append(hist)

            dentro_sla = 0
            fora_sla = 0

            for chamado in chamados_mes:
                try:
                    sla_config = sla_configs.get(chamado.prioridade)
                    if not sla_config:
                        continue

                    data_final = chamado.data_conclusao if chamado.data_conclusao else agora

                    tempo_resolucao_horas = SLACalculator.calculate_business_hours_excluding_paused(
                        chamado.id,
                        chamado.data_abertura,
                        data_final,
                        db,
                        historicos_cache,
                        business_hours_cache
                    )

                    if tempo_resolucao_horas <= sla_config.tempo_resolucao_horas:
                        dentro_sla += 1
                    else:
                        fora_sla += 1

                except Exception as e:
                    print(f"Erro ao processar chamado {chamado.id}: {e}")
                    continue

            total = dentro_sla + fora_sla
            if total == 0:
                return 0

            result = int((dentro_sla / total) * 100)
            
            execution_time = (time.time() - start_time) * 1000
            MetricsCalculator._log_calculation(db, "mes", len(chamados_mes), execution_time)
            
            return result

        except Exception as e:
            print(f"Erro ao calcular SLA compliance mês: {e}")
            import traceback
            traceback.print_exc()
            return 0

    @staticmethod
    def get_chamados_hoje_count(db: Session) -> int:
        """Retorna quantidade de chamados de hoje"""
        return MetricsCalculator.get_chamados_abertos_hoje(db)

    @staticmethod
    def get_comparacao_ontem(db: Session) -> dict:
        """Compara chamados de hoje vs ontem"""
        try:
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
        except Exception as e:
            print(f"Erro ao calcular comparação com ontem: {e}")
            import traceback
            traceback.print_exc()
            return {"hoje": 0, "ontem": 0, "percentual": 0, "direcao": "up"}

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
        """Retorna distribuição de SLA (dentro/fora) - SINCRONIZADO COM CARD SLA e com cache persistente"""
        cached = MetricsCache.get("sla_distribution")
        if cached is not None:
            return cached

        cached_persistent = PersistentMetricsCache.get(db, "sla_distribution")
        if cached_persistent is not None:
            result = cached_persistent.get("value", {})
            MetricsCache.set("sla_distribution", result)
            return result

        result = MetricsCalculator._calculate_sla_distribution(db)
        MetricsCache.set("sla_distribution", result)
        PersistentMetricsCache.set(db, "sla_distribution", {"value": result}, ttl_minutes=10)
        return result

    @staticmethod
    def _calculate_sla_distribution(db: Session) -> dict:
        """Cálculo real - usa MESMOS critérios que get_sla_compliance_mes com otimização historicos_cache e business_hours_cache"""
        start_time = time.time()
        try:
            from ti.services.sla import SLACalculator
            from ti.models.sla_config import SLABusinessHours

            agora = now_brazil_naive()
            mes_inicio = agora.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

            chamados_mes = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= mes_inicio,
                    Chamado.data_abertura <= agora,
                    Chamado.status != "Cancelado",
                    Chamado.data_primeira_resposta.isnot(None)
                )
            ).all()

            sla_configs = {
                config.prioridade: config
                for config in db.query(SLAConfiguration).filter(
                    SLAConfiguration.ativo == True
                ).all()
            }

            if not chamados_mes:
                return {
                    "dentro_sla": 0,
                    "fora_sla": 0,
                    "percentual_dentro": 0,
                    "percentual_fora": 0,
                    "total": 0
                }

            # PRÉ-CARREGAR business hours de uma vez (evita queries em loop)
            business_hours_cache = {}
            for weekday in range(5):
                bh_result = db.query(SLABusinessHours).filter(
                    and_(
                        SLABusinessHours.dia_semana == weekday,
                        SLABusinessHours.ativo == True
                    )
                ).first()
                if bh_result:
                    business_hours_cache[weekday] = (bh_result.hora_inicio, bh_result.hora_fim)
                else:
                    business_hours_cache[weekday] = SLACalculator.DEFAULT_BUSINESS_HOURS.get(weekday)

            chamado_ids = [c.id for c in chamados_mes]
            historicos_bulk = db.query(HistoricoStatus).filter(
                HistoricoStatus.chamado_id.in_(chamado_ids)
            ).all()

            historicos_cache = {}
            for hist in historicos_bulk:
                if hist.chamado_id not in historicos_cache:
                    historicos_cache[hist.chamado_id] = []
                historicos_cache[hist.chamado_id].append(hist)

            dentro_sla = 0
            fora_sla = 0

            for chamado in chamados_mes:
                try:
                    sla_config = sla_configs.get(chamado.prioridade)
                    if not sla_config:
                        continue

                    data_final = chamado.data_conclusao if chamado.data_conclusao else agora
                    tempo_resolucao_horas = SLACalculator.calculate_business_hours_excluding_paused(
                        chamado.id,
                        chamado.data_abertura,
                        data_final,
                        db,
                        historicos_cache,
                        business_hours_cache
                    )

                    if tempo_resolucao_horas <= sla_config.tempo_resolucao_horas:
                        dentro_sla += 1
                    else:
                        fora_sla += 1

                except Exception as e:
                    print(f"Erro ao processar chamado {chamado.id}: {e}")
                    continue

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

            result = {
                "dentro_sla": dentro_sla,
                "fora_sla": fora_sla,
                "percentual_dentro": percentual_dentro,
                "percentual_fora": percentual_fora,
                "total": total
            }
            
            execution_time = (time.time() - start_time) * 1000
            MetricsCalculator._log_calculation(db, "distribution", len(chamados_mes), execution_time)
            
            return result

        except Exception as e:
            print(f"Erro ao calcular distribuição SLA: {e}")
            import traceback
            traceback.print_exc()
            return {
                "dentro_sla": 0,
                "fora_sla": 0,
                "percentual_dentro": 0,
                "percentual_fora": 0,
                "total": 0
            }

    @staticmethod
    def get_performance_metrics(db: Session) -> dict:
        """Retorna métricas de performance (últimos 30 dias) - OTIMIZADO sem N+1 queries e com cache business hours"""
        try:
            from ti.services.sla import SLACalculator
            from ti.models.sla_config import SLABusinessHours

            agora = now_brazil_naive()
            trinta_dias_atras = agora - timedelta(days=30)

            chamados_30dias = db.query(Chamado).filter(
                and_(
                    Chamado.data_abertura >= trinta_dias_atras,
                    Chamado.status != "Cancelado"
                )
            ).all()

            chamado_ids = [c.id for c in chamados_30dias]

            # OTIMIZAÇÃO: Carregar TODOS os históricos de UMA VEZ ao invés de N queries
            historicos_bulk = db.query(HistoricoStatus).filter(
                HistoricoStatus.chamado_id.in_(chamado_ids)
            ).all()

            historicos_cache = {}
            for hist in historicos_bulk:
                if hist.chamado_id not in historicos_cache:
                    historicos_cache[hist.chamado_id] = []
                historicos_cache[hist.chamado_id].append(hist)

            # PRÉ-CARREGAR business hours de uma vez (evita queries em loop)
            business_hours_cache = {}
            for weekday in range(5):
                bh_result = db.query(SLABusinessHours).filter(
                    and_(
                        SLABusinessHours.dia_semana == weekday,
                        SLABusinessHours.ativo == True
                    )
                ).first()
                if bh_result:
                    business_hours_cache[weekday] = (bh_result.hora_inicio, bh_result.hora_fim)
                else:
                    business_hours_cache[weekday] = SLACalculator.DEFAULT_BUSINESS_HOURS.get(weekday)

            tempos_resolucao = []
            for chamado in chamados_30dias:
                if chamado.data_conclusao and chamado.data_abertura:
                    horas = SLACalculator.calculate_business_hours_excluding_paused(
                        chamado.id,
                        chamado.data_abertura,
                        chamado.data_conclusao,
                        db,
                        historicos_cache,
                        business_hours_cache
                    )
                    tempos_resolucao.append(horas)

            tempo_resolucao_medio = sum(tempos_resolucao) / len(tempos_resolucao) if tempos_resolucao else 0
            horas = int(tempo_resolucao_medio)
            minutos = int((tempo_resolucao_medio - horas) * 60)
            tempo_resolucao_str = f"{horas}h {minutos}m" if minutos > 0 else f"{horas}h" if horas > 0 else "—"

            tempos_primeira_resposta = []
            for chamado in chamados_30dias:
                if chamado.data_primeira_resposta and chamado.data_abertura:
                    horas = SLACalculator.calculate_business_hours(
                        chamado.data_abertura,
                        chamado.data_primeira_resposta,
                        db,
                        business_hours_cache
                    )
                    if 0 <= horas <= 72:
                        tempos_primeira_resposta.append(horas)

            tempo_primeira_resposta_medio = sum(tempos_primeira_resposta) / len(tempos_primeira_resposta) if tempos_primeira_resposta else 0

            if tempo_primeira_resposta_medio > 0:
                hrs = int(tempo_primeira_resposta_medio)
                mins = int((tempo_primeira_resposta_medio - hrs) * 60)
                tempo_primeira_resposta_str = f"{hrs}h {mins}m" if mins > 0 else f"{hrs}h"
            else:
                tempo_primeira_resposta_str = "—"

            chamados_reaberlos = 0
            total_com_historico = 0
            
            for chamado in chamados_30dias:
                historicos = historicos_cache.get(chamado.id, [])
                if len(historicos) > 0:
                    total_com_historico += 1
                    if len(historicos) > 5:
                        chamados_reaberlos += 1

            taxa_reaberturas = int((chamados_reaberlos / total_com_historico * 100)) if total_com_historico > 0 else 0

            chamados_backlog = db.query(Chamado).filter(
                and_(
                    Chamado.status.in_(["Aguardando", "Em análise"]),
                    Chamado.status != "Cancelado"
                )
            ).count()

            return {
                "tempo_resolucao_medio": tempo_resolucao_str,
                "primeira_resposta_media": tempo_primeira_resposta_str,
                "taxa_reaberturas": f"{taxa_reaberturas}%",
                "chamados_backlog": chamados_backlog
            }

        except Exception as e:
            print(f"Erro ao calcular métricas de performance: {e}")
            import traceback
            traceback.print_exc()
            return {
                "tempo_resolucao_medio": "—",
                "primeira_resposta_media": "—",
                "taxa_reaberturas": "0%",
                "chamados_backlog": 0
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
        else:
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

        for h in historicos[:15]:
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
        try:
            tempo_resposta_mes, total_chamados_mes = MetricsCalculator.get_tempo_medio_resposta_mes(db)

            chamados_hoje = MetricsCalculator.get_chamados_abertos_hoje(db)
            comparacao_ontem = MetricsCalculator.get_comparacao_ontem(db)
            tempo_resposta_24h = MetricsCalculator.get_tempo_medio_resposta_24h(db)
            sla_compliance = MetricsCalculator.get_sla_compliance_mes(db)
            abertos_agora = MetricsCalculator.get_abertos_agora(db)
            tempo_resolucao = MetricsCalculator.get_tempo_resolucao_media_30dias(db)

            return {
                "chamados_hoje": chamados_hoje,
                "comparacao_ontem": comparacao_ontem,
                "tempo_resposta_24h": tempo_resposta_24h,
                "tempo_resposta_mes": tempo_resposta_mes,
                "total_chamados_mes": total_chamados_mes,
                "sla_compliance_24h": sla_compliance,
                "abertos_agora": abertos_agora,
                "tempo_resolucao_30dias": tempo_resolucao,
            }
        except Exception as e:
            print(f"Erro crítico ao calcular métricas do dashboard: {e}")
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

    @staticmethod
    def _log_calculation(db: Session, calculation_type: str, chamados_count: int, execution_time_ms: float):
        """Log da execução de cálculos SLA para rastrear performance"""
        try:
            log_entry = db.query(SLACalculationLog).filter(
                SLACalculationLog.calculation_type == calculation_type
            ).first()

            if log_entry:
                log_entry.last_calculated_at = datetime.utcnow()
                log_entry.chamados_count = chamados_count
                log_entry.execution_time_ms = execution_time_ms
            else:
                log_entry = SLACalculationLog(
                    calculation_type=calculation_type,
                    last_calculated_at=datetime.utcnow(),
                    chamados_count=chamados_count,
                    execution_time_ms=execution_time_ms
                )
                db.add(log_entry)

            db.commit()
        except Exception as e:
            print(f"Erro ao logar cálculo SLA: {e}")
            db.rollback()
