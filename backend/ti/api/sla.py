from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from sqlalchemy import and_
from core.db import get_db, engine
from ti.schemas.sla import (
    SLAConfigurationCreate,
    SLAConfigurationUpdate,
    SLAConfigurationOut,
    SLABusinessHoursCreate,
    SLABusinessHoursOut,
    HistoricoSLAOut,
    SLAStatusResponse,
)
from ti.models.sla_config import SLAConfiguration, SLABusinessHours, HistoricoSLA
from ti.models.chamado import Chamado
from ti.services.sla import SLACalculator
from ti.services.sla_cache import SLACacheManager
from ti.services.sla_validator import SLAValidator
from core.utils import now_brazil_naive

router = APIRouter(prefix="/sla", tags=["TI - SLA"])


@router.get("/config", response_model=list[SLAConfigurationOut])
def listar_sla_config(db: Session = Depends(get_db)):
    try:
        try:
            SLAConfiguration.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        return db.query(SLAConfiguration).order_by(SLAConfiguration.prioridade.asc()).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar configurações de SLA: {e}")


@router.post("/config", response_model=SLAConfigurationOut)
def criar_sla_config(payload: SLAConfigurationCreate, db: Session = Depends(get_db)):
    try:
        try:
            SLAConfiguration.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        existente = db.query(SLAConfiguration).filter(
            SLAConfiguration.prioridade == payload.prioridade
        ).first()
        if existente:
            raise HTTPException(
                status_code=400,
                detail=f"Configuração de SLA para prioridade '{payload.prioridade}' já existe"
            )

        config = SLAConfiguration(
            prioridade=payload.prioridade,
            tempo_resposta_horas=payload.tempo_resposta_horas,
            tempo_resolucao_horas=payload.tempo_resolucao_horas,
            descricao=payload.descricao,
            ativo=payload.ativo,
            criado_em=now_brazil_naive(),
            atualizado_em=now_brazil_naive(),
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar configuração de SLA: {e}")


@router.patch("/config/{config_id}", response_model=SLAConfigurationOut)
def atualizar_sla_config(
    config_id: int,
    payload: SLAConfigurationUpdate,
    db: Session = Depends(get_db)
):
    try:
        try:
            SLAConfiguration.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        config = db.query(SLAConfiguration).filter(SLAConfiguration.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Configuração de SLA não encontrada")

        if payload.tempo_resposta_horas is not None:
            config.tempo_resposta_horas = payload.tempo_resposta_horas
        if payload.tempo_resolucao_horas is not None:
            config.tempo_resolucao_horas = payload.tempo_resolucao_horas
        if payload.descricao is not None:
            config.descricao = payload.descricao
        if payload.ativo is not None:
            config.ativo = payload.ativo

        config.atualizado_em = now_brazil_naive()
        db.add(config)
        db.commit()
        db.refresh(config)
        return config
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar configuração de SLA: {e}")


@router.delete("/config/{config_id}")
def deletar_sla_config(config_id: int, db: Session = Depends(get_db)):
    try:
        try:
            SLAConfiguration.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        config = db.query(SLAConfiguration).filter(SLAConfiguration.id == config_id).first()
        if not config:
            raise HTTPException(status_code=404, detail="Configuração de SLA não encontrada")

        db.delete(config)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar configuração de SLA: {e}")


@router.get("/business-hours", response_model=list[SLABusinessHoursOut])
def listar_business_hours(db: Session = Depends(get_db)):
    try:
        try:
            SLABusinessHours.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass
        return db.query(SLABusinessHours).order_by(SLABusinessHours.dia_semana.asc()).all()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar horários comerciais: {e}")


@router.post("/business-hours", response_model=SLABusinessHoursOut)
def criar_business_hours(payload: SLABusinessHoursCreate, db: Session = Depends(get_db)):
    try:
        try:
            SLABusinessHours.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        existente = db.query(SLABusinessHours).filter(
            SLABusinessHours.dia_semana == payload.dia_semana
        ).first()
        if existente:
            raise HTTPException(
                status_code=400,
                detail=f"Horário comercial para dia {payload.dia_semana} já existe"
            )

        bh = SLABusinessHours(
            dia_semana=payload.dia_semana,
            hora_inicio=payload.hora_inicio,
            hora_fim=payload.hora_fim,
            ativo=payload.ativo,
            criado_em=now_brazil_naive(),
            atualizado_em=now_brazil_naive(),
        )
        db.add(bh)
        db.commit()
        db.refresh(bh)
        return bh
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao criar horário comercial: {e}")


@router.patch("/business-hours/{bh_id}", response_model=SLABusinessHoursOut)
def atualizar_business_hours(
    bh_id: int,
    payload: SLABusinessHoursCreate,
    db: Session = Depends(get_db)
):
    try:
        try:
            SLABusinessHours.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        bh = db.query(SLABusinessHours).filter(SLABusinessHours.id == bh_id).first()
        if not bh:
            raise HTTPException(status_code=404, detail="Horário comercial não encontrado")

        bh.hora_inicio = payload.hora_inicio
        bh.hora_fim = payload.hora_fim
        bh.ativo = payload.ativo
        bh.atualizado_em = now_brazil_naive()

        db.add(bh)
        db.commit()
        db.refresh(bh)
        return bh
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao atualizar horário comercial: {e}")


@router.delete("/business-hours/{bh_id}")
def deletar_business_hours(bh_id: int, db: Session = Depends(get_db)):
    try:
        try:
            SLABusinessHours.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        bh = db.query(SLABusinessHours).filter(SLABusinessHours.id == bh_id).first()
        if not bh:
            raise HTTPException(status_code=404, detail="Horário comercial não encontrado")

        db.delete(bh)
        db.commit()
        return {"ok": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao deletar horário comercial: {e}")


@router.get("/chamado/{chamado_id}/status", response_model=dict)
def obter_sla_status_chamado(chamado_id: int, db: Session = Depends(get_db)):
    try:
        try:
            SLAConfiguration.__table__.create(bind=engine, checkfirst=True)
            SLABusinessHours.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        chamado = db.query(Chamado).filter(Chamado.id == chamado_id).first()
        if not chamado:
            raise HTTPException(status_code=404, detail="Chamado não encontrado")

        sla_status = SLACalculator.get_sla_status(db, chamado)
        return sla_status
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter status de SLA: {e}")


@router.get("/historico/{chamado_id}", response_model=list[HistoricoSLAOut])
def obter_historico_sla(chamado_id: int, db: Session = Depends(get_db)):
    try:
        try:
            HistoricoSLA.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        historicos = db.query(HistoricoSLA).filter(
            HistoricoSLA.chamado_id == chamado_id
        ).order_by(HistoricoSLA.criado_em.desc()).all()

        return historicos
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao obter histórico de SLA: {e}")


@router.post("/sync/todos-chamados")
def sincronizar_todos_chamados(db: Session = Depends(get_db)):
    """
    Sincroniza todos os chamados existentes com a tabela de histórico de SLA.
    Deve ser executado uma única vez ou para revalidação completa.
    """
    try:
        try:
            HistoricoSLA.__table__.create(bind=engine, checkfirst=True)
            Chamado.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        stats = {
            "total_chamados": 0,
            "sincronizados": 0,
            "atualizados": 0,
            "erros": 0,
        }

        chamados = db.query(Chamado).all()
        stats["total_chamados"] = len(chamados)

        for chamado in chamados:
            try:
                # Verifica se já existe histórico para este chamado
                existing = db.query(HistoricoSLA).filter(
                    HistoricoSLA.chamado_id == chamado.id
                ).first()

                sla_status = SLACalculator.get_sla_status(db, chamado)

                if existing:
                    # Atualiza registro existente
                    existing.status_novo = chamado.status
                    existing.tempo_resolucao_horas = sla_status.get("tempo_resolucao_horas")
                    existing.limite_sla_horas = sla_status.get("tempo_resolucao_limite_horas")
                    existing.status_sla = sla_status.get("tempo_resolucao_status")
                    db.add(existing)
                    stats["atualizados"] += 1
                else:
                    # Cria novo registro
                    historico = HistoricoSLA(
                        chamado_id=chamado.id,
                        usuario_id=None,
                        acao="sincronizacao",
                        status_anterior=None,
                        status_novo=chamado.status,
                        tempo_resolucao_horas=sla_status.get("tempo_resolucao_horas"),
                        limite_sla_horas=sla_status.get("tempo_resolucao_limite_horas"),
                        status_sla=sla_status.get("tempo_resolucao_status"),
                        criado_em=chamado.data_abertura or now_brazil_naive(),
                    )
                    db.add(historico)
                    stats["sincronizados"] += 1

            except Exception:
                stats["erros"] += 1
                db.rollback()

        db.commit()
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao sincronizar chamados: {e}")


@router.post("/recalcular/painel")
def recalcular_sla_painel(db: Session = Depends(get_db)):
    """
    Recalcula todos os SLAs quando o painel administrativo é acessado.
    Atualiza métricas para visualização correta.
    """
    try:
        try:
            HistoricoSLA.__table__.create(bind=engine, checkfirst=True)
            Chamado.__table__.create(bind=engine, checkfirst=True)
        except Exception:
            pass

        stats = {
            "total_recalculados": 0,
            "em_dia": 0,
            "vencidos": 0,
            "em_andamento": 0,
            "congelados": 0,
            "erros": 0,
        }

        chamados = db.query(Chamado).filter(
            and_(
                Chamado.status != "Cancelado",
                Chamado.status != "Concluído"
            )
        ).all()

        for chamado in chamados:
            try:
                sla_status = SLACalculator.get_sla_status(db, chamado)

                # Atualiza ou cria histórico com cálculo atual
                existing = db.query(HistoricoSLA).filter(
                    HistoricoSLA.chamado_id == chamado.id
                ).order_by(HistoricoSLA.criado_em.desc()).first()

                if existing:
                    existing.tempo_resolucao_horas = sla_status.get("tempo_resolucao_horas")
                    existing.status_sla = sla_status.get("tempo_resolucao_status")
                    db.add(existing)
                else:
                    historico = HistoricoSLA(
                        chamado_id=chamado.id,
                        usuario_id=None,
                        acao="recalculo_painel",
                        status_novo=chamado.status,
                        tempo_resolucao_horas=sla_status.get("tempo_resolucao_horas"),
                        limite_sla_horas=sla_status.get("tempo_resolucao_limite_horas"),
                        status_sla=sla_status.get("tempo_resolucao_status"),
                        criado_em=now_brazil_naive(),
                    )
                    db.add(historico)

                stats["total_recalculados"] += 1

                status_sla = sla_status.get("tempo_resolucao_status", "sem_configuracao")
                if status_sla == "ok":
                    stats["em_dia"] += 1
                elif status_sla == "vencido":
                    stats["vencidos"] += 1
                elif status_sla == "em_andamento":
                    stats["em_andamento"] += 1
                elif status_sla == "congelado":
                    stats["congelados"] += 1

            except Exception as e:
                print(f"Erro ao recalcular SLA do chamado {chamado.id}: {e}")
                stats["erros"] += 1
                db.rollback()

        db.commit()
        return stats

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao recalcular SLAs: {e}")


@router.post("/cache/invalidate-chamado/{chamado_id}")
def invalidar_cache_chamado(chamado_id: int, db: Session = Depends(get_db)):
    """
    Invalida caches relacionados a um chamado específico.
    Deve ser chamado quando um chamado é atualizado.
    """
    try:
        SLACacheManager.invalidate_by_chamado(db, chamado_id)
        return {"ok": True, "chamado_id": chamado_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao invalidar cache: {e}")


@router.post("/cache/invalidate-all")
def invalidar_todos_caches(db: Session = Depends(get_db)):
    """
    Invalida TODOS os caches de SLA.
    Deve ser chamado quando configurações de SLA são alteradas.
    """
    try:
        SLACacheManager.invalidate_all_sla(db)
        return {"ok": True, "message": "Todos os caches de SLA foram invalidados"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao invalidar cache: {e}")


@router.post("/cache/warmup")
def preaquecer_cache(db: Session = Depends(get_db)):
    """
    Pré-aquece o cache ao abrir o painel administrativo.
    Calcula todas as métricas pesadas antecipadamente.
    """
    try:
        from ti.services.metrics import MetricsCalculator

        stats = {
            "total_calculados": 0,
            "tempo_ms": 0,
            "erro": None
        }

        import time
        start = time.time()

        MetricsCalculator.get_sla_compliance_24h(db)
        MetricsCalculator.get_sla_compliance_mes(db)
        MetricsCalculator.get_sla_distribution(db)
        MetricsCalculator.get_tempo_medio_resposta_24h(db)
        MetricsCalculator.get_tempo_medio_resposta_mes(db)
        MetricsCalculator.get_abertos_agora(db)
        MetricsCalculator.get_chamados_abertos_hoje(db)

        stats["total_calculados"] = 7
        stats["tempo_ms"] = int((time.time() - start) * 1000)

        return stats
    except Exception as e:
        print(f"Erro ao preaquecer cache: {e}")
        import traceback
        traceback.print_exc()
        return {
            "total_calculados": 0,
            "tempo_ms": 0,
            "erro": str(e)
        }


@router.get("/cache/stats")
def obter_stats_cache(db: Session = Depends(get_db)):
    """
    Retorna estatísticas do sistema de cache.
    """
    try:
        stats = SLACacheManager.get_stats(db)
        return stats
    except Exception as e:
        return {
            "error": str(e),
            "memory_entries": 0,
            "database_entries": 0,
            "expired_in_db": 0
        }


@router.post("/cache/cleanup")
def limpar_cache_expirado(db: Session = Depends(get_db)):
    """
    Remove caches expirados do banco de dados.
    Deve ser executado periodicamente (recomendado: a cada hora).
    """
    try:
        removed = SLACacheManager.clear_expired(db)
        return {
            "ok": True,
            "removed": removed
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao limpar cache: {e}")


@router.get("/validate/config/{config_id}")
def validar_configuracao(config_id: int, db: Session = Depends(get_db)):
    """
    Valida uma configuração de SLA individual.
    Retorna status de validação e lista de erros/warnings.
    """
    try:
        config = db.query(SLAConfiguration).filter(
            SLAConfiguration.id == config_id
        ).first()

        if not config:
            raise HTTPException(status_code=404, detail="Configuração de SLA não encontrada")

        validacao = SLAValidator.validar_configuracao(config)
        return validacao
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao validar configuração: {e}")


@router.get("/validate/all")
def validar_todas_configuracoes(db: Session = Depends(get_db)):
    """
    Valida TODAS as configurações de SLA e horários comerciais.
    Retorna resumo completo com erros e warnings.
    """
    try:
        validacao = SLAValidator.validar_todas_configuracoes(db)
        return validacao
    except Exception as e:
        return {
            "sistema_valido": False,
            "erro": str(e),
            "configuracoes": [],
            "horarios_comerciais": {
                "valida": False,
                "erros": [str(e)],
                "warnings": [],
            },
            "resumo": {
                "total_configs": 0,
                "configs_validas": 0,
                "total_erros": 1,
                "total_warnings": 0,
            },
        }


@router.get("/validate/chamado/{chamado_id}")
def validar_dados_chamado(chamado_id: int, db: Session = Depends(get_db)):
    """
    Valida dados de um chamado específico para cálculo de SLA.
    Útil para debug de cálculos incorretos.
    """
    try:
        validacao = SLAValidator.validar_dados_chamado(db, chamado_id)
        return validacao
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
