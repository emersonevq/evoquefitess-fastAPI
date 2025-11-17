from __future__ import annotations
from datetime import datetime, time, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from ti.models.sla_config import SLAConfiguration, SLABusinessHours, HistoricoSLA
from ti.models.chamado import Chamado
from core.utils import now_brazil_naive


class SLACalculator:
    DEFAULT_BUSINESS_HOURS = {
        0: ("08:00", "18:00"),
        1: ("08:00", "18:00"),
        2: ("08:00", "18:00"),
        3: ("08:00", "18:00"),
        4: ("08:00", "18:00"),
    }

    @staticmethod
    def get_business_hours(db: Session, dia_semana: int) -> tuple[str, str] | None:
        try:
            bh = db.query(SLABusinessHours).filter(
                and_(
                    SLABusinessHours.dia_semana == dia_semana,
                    SLABusinessHours.ativo == True
                )
            ).first()
            if bh:
                return (bh.hora_inicio, bh.hora_fim)
        except Exception:
            pass
        return SLACalculator.DEFAULT_BUSINESS_HOURS.get(dia_semana)

    @staticmethod
    def is_business_day(data: datetime) -> bool:
        return data.weekday() < 5

    @staticmethod
    def is_business_time(dt: datetime, db: Session | None = None) -> bool:
        if not SLACalculator.is_business_day(dt):
            return False

        bh = None
        if db:
            bh = SLACalculator.get_business_hours(db, dt.weekday())
        else:
            bh = SLACalculator.DEFAULT_BUSINESS_HOURS.get(dt.weekday())

        if not bh:
            return False

        hora_inicio = datetime.strptime(bh[0], "%H:%M").time()
        hora_fim = datetime.strptime(bh[1], "%H:%M").time()
        return hora_inicio <= dt.time() <= hora_fim

    @staticmethod
    def calculate_business_hours(start: datetime, end: datetime, db: Session | None = None) -> float:
        if start >= end:
            return 0.0

        total_minutes = 0
        current = start

        while current < end:
            next_day = (current + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)

            if not SLACalculator.is_business_day(current):
                current = next_day
                continue

            bh = None
            if db:
                bh = SLACalculator.get_business_hours(db, current.weekday())
            else:
                bh = SLACalculator.DEFAULT_BUSINESS_HOURS.get(current.weekday())

            if not bh:
                current = next_day
                continue

            hora_inicio = datetime.strptime(bh[0], "%H:%M").time()
            hora_fim = datetime.strptime(bh[1], "%H:%M").time()

            day_start = current.replace(hour=hora_inicio.hour, minute=hora_inicio.minute, second=0, microsecond=0)
            day_end = current.replace(hour=hora_fim.hour, minute=hora_fim.minute, second=0, microsecond=0)

            if current < day_start:
                current = day_start

            if end <= day_end:
                total_minutes += int((end - current).total_seconds() / 60)
                break
            else:
                total_minutes += int((day_end - current).total_seconds() / 60)
                current = next_day

        return total_minutes / 60.0

    @staticmethod
    def get_sla_config_by_priority(db: Session, prioridade: str) -> SLAConfiguration | None:
        try:
            return db.query(SLAConfiguration).filter(
                and_(
                    SLAConfiguration.prioridade == prioridade,
                    SLAConfiguration.ativo == True
                )
            ).first()
        except Exception:
            return None

    @staticmethod
    def get_sla_status(db: Session, chamado: Chamado) -> dict:
        sla_config = SLACalculator.get_sla_config_by_priority(db, chamado.prioridade)

        if not sla_config:
            return {
                "chamado_id": chamado.id,
                "prioridade": chamado.prioridade,
                "status": chamado.status,
                "tempo_decorrido_horas": 0,
                "tempo_resposta_limite_horas": 0,
                "tempo_resolucao_limite_horas": 0,
                "tempo_resposta_status": "sem_configuracao",
                "tempo_resolucao_status": "sem_configuracao",
                "data_abertura": chamado.data_abertura,
                "data_primeira_resposta": chamado.data_primeira_resposta,
                "data_conclusao": chamado.data_conclusao,
            }

        data_abertura = chamado.data_abertura or now_brazil_naive()
        agora = now_brazil_naive()

        tempo_resposta_horas = 0
        tempo_resposta_status = "ok"

        if chamado.data_primeira_resposta:
            tempo_resposta_horas = SLACalculator.calculate_business_hours(data_abertura, chamado.data_primeira_resposta, db)
            if tempo_resposta_horas > sla_config.tempo_resposta_horas:
                tempo_resposta_status = "vencido"
            else:
                tempo_resposta_status = "ok"
        elif chamado.status not in ["Concluído", "Cancelado"]:
            tempo_resposta_horas = SLACalculator.calculate_business_hours(data_abertura, agora, db)
            if tempo_resposta_horas > sla_config.tempo_resposta_horas:
                tempo_resposta_status = "vencido"
            else:
                tempo_resposta_status = "em_andamento"

        tempo_resolucao_horas = 0
        tempo_resolucao_status = "ok"

        if chamado.status == "Em análise":
            tempo_resolucao_status = "congelado"
        elif chamado.data_conclusao:
            tempo_resolucao_horas = SLACalculator.calculate_business_hours(data_abertura, chamado.data_conclusao, db)
            if tempo_resolucao_horas > sla_config.tempo_resolucao_horas:
                tempo_resolucao_status = "vencido"
            else:
                tempo_resolucao_status = "ok"
        elif chamado.status not in ["Concluído", "Cancelado"]:
            tempo_resolucao_horas = SLACalculator.calculate_business_hours(data_abertura, agora, db)
            if tempo_resolucao_horas > sla_config.tempo_resolucao_horas:
                tempo_resolucao_status = "vencido"
            else:
                tempo_resolucao_status = "em_andamento"

        return {
            "chamado_id": chamado.id,
            "prioridade": chamado.prioridade,
            "status": chamado.status,
            "tempo_decorrido_horas": max(tempo_resposta_horas, tempo_resolucao_horas),
            "tempo_resposta_limite_horas": sla_config.tempo_resposta_horas,
            "tempo_resolucao_limite_horas": sla_config.tempo_resolucao_horas,
            "tempo_resposta_horas": tempo_resposta_horas,
            "tempo_resposta_status": tempo_resposta_status,
            "tempo_resolucao_horas": tempo_resolucao_horas,
            "tempo_resolucao_status": tempo_resolucao_status,
            "data_abertura": chamado.data_abertura,
            "data_primeira_resposta": chamado.data_primeira_resposta,
            "data_conclusao": chamado.data_conclusao,
        }

    @staticmethod
    def record_sla_history(
        db: Session,
        chamado_id: int,
        usuario_id: int | None,
        acao: str,
        status_anterior: str | None = None,
        status_novo: str | None = None,
        tempo_resolucao_horas: float | None = None,
        limite_sla_horas: float | None = None,
        status_sla: str | None = None,
    ) -> HistoricoSLA:
        try:
            historico = HistoricoSLA(
                chamado_id=chamado_id,
                usuario_id=usuario_id,
                acao=acao,
                status_anterior=status_anterior,
                status_novo=status_novo,
                tempo_resolucao_horas=tempo_resolucao_horas,
                limite_sla_horas=limite_sla_horas,
                status_sla=status_sla,
                criado_em=now_brazil_naive(),
            )
            db.add(historico)
            db.commit()
            db.refresh(historico)
            return historico
        except Exception as e:
            db.rollback()
            raise e
