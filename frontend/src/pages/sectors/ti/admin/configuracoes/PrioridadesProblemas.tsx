import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
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
import { toast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";

interface Problema {
  id: number;
  nome: string;
  prioridade: string;
  requer_internet: boolean;
  tempo_resolucao_horas: number | null;
}

const PRIORIDADES = ["Crítica", "Alta", "Normal", "Baixa"];

export function PrioridadesProblemas() {
  const [problemas, setProblemas] = useState<Problema[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    nome: "",
    prioridade: "Normal",
    tempo_resolucao_horas: "",
    requer_internet: false,
  });

  useEffect(() => {
    carregarProblemas();
  }, []);

  const carregarProblemas = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/problemas");
      if (!response.ok) throw new Error("Falha ao carregar problemas");
      const data = await response.json();
      setProblemas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Erro ao carregar problemas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os problemas",
        variant: "destructive",
      });
      setProblemas([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome.trim()) {
      toast({
        title: "Aviso",
        description: "Nome do problema é obrigatório",
      });
      return;
    }

    try {
      const payload = {
        nome: formData.nome,
        prioridade: formData.prioridade,
        tempo_resolucao_horas: formData.tempo_resolucao_horas
          ? parseInt(formData.tempo_resolucao_horas)
          : null,
        requer_internet: formData.requer_internet,
      };

      if (editingId) {
        // Edição via PATCH (seria necessário implementar no backend)
        toast({
          title: "Info",
          description: "Edição será implementada em breve",
        });
      } else {
        const response = await apiFetch("/problemas", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error("Falha ao criar problema");

        toast({
          title: "Sucesso",
          description: "Problema criado com sucesso",
        });

        carregarProblemas();
        setFormData({
          nome: "",
          prioridade: "Normal",
          tempo_resolucao_horas: "",
          requer_internet: false,
        });
        setOpen(false);
      }
    } catch (error) {
      console.error("Erro ao salvar problema:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o problema",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (problema: Problema) => {
    setEditingId(problema.id);
    setFormData({
      nome: problema.nome,
      prioridade: problema.prioridade,
      tempo_resolucao_horas: problema.tempo_resolucao_horas?.toString() || "",
      requer_internet: problema.requer_internet,
    });
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setEditingId(null);
    setFormData({
      nome: "",
      prioridade: "Normal",
      tempo_resolucao_horas: "",
      requer_internet: false,
    });
  };

  const formatTempo = (horas: number | null) => {
    if (!horas) return "—";
    if (horas < 24) return `${horas}h`;
    const dias = horas / 24;
    return dias % 1 === 0 ? `${dias}d` : `${horas}h`;
  };

  const getPrioridadeColor = (prioridade: string) => {
    const colors: Record<string, string> = {
      Crítica: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      Alta: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      Normal: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      Baixa:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
    return colors[prioridade] || colors.Normal;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Problemas e Prioridades</h2>
          <p className="text-sm text-muted-foreground">
            Gerencie as prioridades padrão e tempos de resolução dos problemas
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>Novo Problema</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Editar Problema" : "Novo Problema"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome do Problema</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Hardware, Software, Rede..."
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  disabled={editingId !== null}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="prioridade">Prioridade Padrão</Label>
                <Select
                  value={formData.prioridade}
                  onValueChange={(value) =>
                    setFormData({ ...formData, prioridade: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORIDADES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tempo">Tempo Máximo de Resolução (horas)</Label>
                <Input
                  id="tempo"
                  type="number"
                  placeholder="Ex: 24, 48, 72..."
                  value={formData.tempo_resolucao_horas}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      tempo_resolucao_horas: e.target.value,
                    })
                  }
                  min="1"
                />
                <p className="text-xs text-muted-foreground">
                  Deixe vazio para não definir prazo
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="internet"
                  checked={formData.requer_internet}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requer_internet: e.target.checked,
                    })
                  }
                  className="rounded border-gray-300"
                />
                <Label htmlFor="internet" className="mb-0">
                  Requer Item de Internet
                </Label>
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingId ? "Atualizar" : "Criar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">
          Carregando problemas...
        </div>
      ) : problemas.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum problema cadastrado. Crie um novo para começar.
        </div>
      ) : (
        <div className="space-y-3">
          {problemas.map((problema) => (
            <div
              key={problema.id}
              className="card-surface rounded-lg p-4 flex items-center justify-between gap-4 border border-border/60"
            >
              <div className="flex-1 space-y-1">
                <h3 className="font-medium">{problema.nome}</h3>
                <div className="flex items-center gap-4 text-sm">
                  <span
                    className={`inline-block px-2 py-1 rounded-md text-xs font-medium ${getPrioridadeColor(problema.prioridade)}`}
                  >
                    {problema.prioridade}
                  </span>
                  {problema.tempo_resolucao_horas && (
                    <span className="text-muted-foreground">
                      Prazo: {formatTempo(problema.tempo_resolucao_horas)}
                    </span>
                  )}
                  {problema.requer_internet && (
                    <span className="text-muted-foreground">
                      Requer Internet
                    </span>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleEdit(problema)}
              >
                Editar
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
