import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, Edit2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toast } from "sonner";

interface SLAConfig {
  id: number;
  prioridade: string;
  tempo_resposta_horas: number;
  tempo_resolucao_horas: number;
  descricao: string | null;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
}

interface BusinessHours {
  id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  criado_em: string | null;
  atualizado_em: string | null;
}

const DIAS_SEMANA = [
  { id: 0, label: "Segunda-feira" },
  { id: 1, label: "Terça-feira" },
  { id: 2, label: "Quarta-feira" },
  { id: 3, label: "Quinta-feira" },
  { id: 4, label: "Sexta-feira" },
];

export function SLA() {
  const queryClient = useQueryClient();
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SLAConfig | null>(null);
  const [editingHours, setEditingHours] = useState<BusinessHours | null>(null);

  const [formData, setFormData] = useState({
    prioridade: "",
    tempo_resposta_horas: 2,
    tempo_resolucao_horas: 8,
    descricao: "",
  });

  const [hoursData, setHoursData] = useState({
    dia_semana: 0,
    hora_inicio: "08:00",
    hora_fim: "18:00",
  });

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ["sla-config"],
    queryFn: async () => {
      const response = await api.get("/sla/config");
      return response.data;
    },
  });

  const { data: businessHours = [], isLoading: hoursLoading } = useQuery({
    queryKey: ["sla-business-hours"],
    queryFn: async () => {
      const response = await api.get("/sla/business-hours");
      return response.data;
    },
  });

  const createConfigMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await api.post("/sla/config", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-config"] });
      setShowConfigDialog(false);
      setFormData({
        prioridade: "",
        tempo_resposta_horas: 2,
        tempo_resolucao_horas: 8,
        descricao: "",
      });
      toast.success("Configuração de SLA criada com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erro ao criar configuração");
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (data: {
      id: number;
      updates: Partial<typeof formData>;
    }) => {
      const response = await api.patch(`/sla/config/${data.id}`, data.updates);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-config"] });
      setShowConfigDialog(false);
      setEditingConfig(null);
      setFormData({
        prioridade: "",
        tempo_resposta_horas: 2,
        tempo_resolucao_horas: 8,
        descricao: "",
      });
      toast.success("Configuração atualizada com sucesso");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail || "Erro ao atualizar configuração",
      );
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sla/config/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-config"] });
      toast.success("Configuração removida com sucesso");
    },
    onError: (error: any) => {
      toast.error(
        error.response?.data?.detail || "Erro ao remover configuração",
      );
    },
  });

  const createHoursMutation = useMutation({
    mutationFn: async (data: typeof hoursData) => {
      const response = await api.post("/sla/business-hours", data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-business-hours"] });
      setShowHoursDialog(false);
      setHoursData({
        dia_semana: 0,
        hora_inicio: "08:00",
        hora_fim: "18:00",
      });
      toast.success("Horário comercial adicionado com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erro ao adicionar horário");
    },
  });

  const updateHoursMutation = useMutation({
    mutationFn: async (data: { id: number; updates: typeof hoursData }) => {
      const response = await api.patch(
        `/sla/business-hours/${data.id}`,
        data.updates,
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-business-hours"] });
      setShowHoursDialog(false);
      setEditingHours(null);
      setHoursData({
        dia_semana: 0,
        hora_inicio: "08:00",
        hora_fim: "18:00",
      });
      toast.success("Horário atualizado com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erro ao atualizar horário");
    },
  });

  const deleteHoursMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/sla/business-hours/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sla-business-hours"] });
      toast.success("Horário removido com sucesso");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || "Erro ao remover horário");
    },
  });

  const handleAddConfig = () => {
    setEditingConfig(null);
    setFormData({
      prioridade: "",
      tempo_resposta_horas: 2,
      tempo_resolucao_horas: 8,
      descricao: "",
    });
    setShowConfigDialog(true);
  };

  const handleEditConfig = (config: SLAConfig) => {
    setEditingConfig(config);
    setFormData({
      prioridade: config.prioridade,
      tempo_resposta_horas: config.tempo_resposta_horas,
      tempo_resolucao_horas: config.tempo_resolucao_horas,
      descricao: config.descricao || "",
    });
    setShowConfigDialog(true);
  };

  const handleSaveConfig = () => {
    if (!formData.prioridade) {
      toast.error("Preencha o campo de prioridade");
      return;
    }

    if (editingConfig) {
      updateConfigMutation.mutate({
        id: editingConfig.id,
        updates: {
          tempo_resposta_horas: formData.tempo_resposta_horas,
          tempo_resolucao_horas: formData.tempo_resolucao_horas,
          descricao: formData.descricao,
        },
      });
    } else {
      createConfigMutation.mutate(formData);
    }
  };

  const handleAddHours = () => {
    setEditingHours(null);
    setHoursData({
      dia_semana: 0,
      hora_inicio: "08:00",
      hora_fim: "18:00",
    });
    setShowHoursDialog(true);
  };

  const handleEditHours = (hours: BusinessHours) => {
    setEditingHours(hours);
    setHoursData({
      dia_semana: hours.dia_semana,
      hora_inicio: hours.hora_inicio,
      hora_fim: hours.hora_fim,
    });
    setShowHoursDialog(true);
  };

  const handleSaveHours = () => {
    if (editingHours) {
      updateHoursMutation.mutate({
        id: editingHours.id,
        updates: hoursData,
      });
    } else {
      const dayExists = businessHours.some(
        (h: BusinessHours) => h.dia_semana === hoursData.dia_semana,
      );
      if (dayExists) {
        toast.error("Horário para este dia já existe");
        return;
      }
      createHoursMutation.mutate(hoursData);
    }
  };

  const getDiaLabel = (dia: number) => {
    return DIAS_SEMANA.find((d) => d.id === dia)?.label || `Dia ${dia}`;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Níveis de SLA e Prioridades</h2>
          <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
            <DialogTrigger asChild>
              <Button onClick={handleAddConfig} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar SLA
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingConfig ? "Editar SLA" : "Criar novo SLA"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Prioridade</Label>
                  <Input
                    disabled={!!editingConfig}
                    placeholder="Ex: Crítico, Alto, Normal, Baixo"
                    value={formData.prioridade}
                    onChange={(e) =>
                      setFormData({ ...formData, prioridade: e.target.value })
                    }
                  />
                </div>
                <div>
                  <Label>Tempo de Resposta (horas)</Label>
                  <Input
                    type="number"
                    min="0.5"
                    step="0.5"
                    value={formData.tempo_resposta_horas}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tempo_resposta_horas: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Tempo de Resolução (horas)</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={formData.tempo_resolucao_horas}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        tempo_resolucao_horas: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Input
                    placeholder="Descrição do nível de SLA"
                    value={formData.descricao}
                    onChange={(e) =>
                      setFormData({ ...formData, descricao: e.target.value })
                    }
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowConfigDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveConfig}>
                    {editingConfig ? "Atualizar" : "Criar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {configsLoading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : configs.length > 0 ? (
          <div className="grid gap-3">
            {configs.map((config: SLAConfig) => (
              <Card key={config.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h3 className="font-medium">{config.prioridade}</h3>
                    {config.descricao && (
                      <p className="text-sm text-muted-foreground">
                        {config.descricao}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Resposta:</span>
                        <p className="font-semibold">
                          {config.tempo_resposta_horas}h
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">
                          Resolução:
                        </span>
                        <p className="font-semibold">
                          {config.tempo_resolucao_horas}h
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditConfig(config)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteConfigMutation.mutate(config.id)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma configuração de SLA criada
          </div>
        )}
      </div>

      <div className="border-t pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Horários Comerciais</h2>
          <Dialog open={showHoursDialog} onOpenChange={setShowHoursDialog}>
            <DialogTrigger asChild>
              <Button onClick={handleAddHours} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Horário
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingHours
                    ? "Editar Horário"
                    : "Adicionar Horário Comercial"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Dia da Semana</Label>
                  <Select
                    value={String(hoursData.dia_semana)}
                    onValueChange={(value) =>
                      setHoursData({
                        ...hoursData,
                        dia_semana: parseInt(value),
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIAS_SEMANA.map((dia) => (
                        <SelectItem key={dia.id} value={String(dia.id)}>
                          {dia.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Início</Label>
                    <Input
                      type="time"
                      value={hoursData.hora_inicio}
                      onChange={(e) =>
                        setHoursData({
                          ...hoursData,
                          hora_inicio: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input
                      type="time"
                      value={hoursData.hora_fim}
                      onChange={(e) =>
                        setHoursData({
                          ...hoursData,
                          hora_fim: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowHoursDialog(false)}
                  >
                    Cancelar
                  </Button>
                  <Button onClick={handleSaveHours}>
                    {editingHours ? "Atualizar" : "Adicionar"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {hoursLoading ? (
          <div className="text-muted-foreground">Carregando...</div>
        ) : businessHours.length > 0 ? (
          <div className="grid gap-3">
            {businessHours.map((hours: BusinessHours) => (
              <Card key={hours.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">
                      {getDiaLabel(hours.dia_semana)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {hours.hora_inicio} - {hours.hora_fim}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditHours(hours)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteHoursMutation.mutate(hours.id)}
                      className="p-2 hover:bg-muted rounded-lg transition-colors text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum horário comercial configurado
          </div>
        )}
      </div>
    </div>
  );
}
