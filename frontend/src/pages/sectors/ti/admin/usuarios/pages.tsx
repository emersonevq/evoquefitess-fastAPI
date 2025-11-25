import { useEffect, useMemo, useState } from "react";
import { usuariosMock } from "../mock";
import { sectors, loadBISubcategories } from "@/data/sectors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";

const normalize = (s: string) => {
  try {
    return s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\u00a0/g, " ")
      .trim();
  } catch {
    return s;
  }
};

const matchSectorTitle = (value: string | null | undefined) => {
  if (!value) return null;
  const n = normalize(String(value));
  const found = sectors.find((sec) => normalize(sec.title) === n);
  return found ? found.title : value;
};

export function CriarUsuario() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [level, setLevel] = useState("Funcionário");
  const [selSectors, setSelSectors] = useState<string[]>([]);
  const [selBiSubcategories, setSelBiSubcategories] = useState<string[]>([]);
  const [forceReset, setForceReset] = useState(true);

  const [emailTaken, setEmailTaken] = useState<boolean | null>(null);
  const [usernameTaken, setUsernameTaken] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);

  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null,
  );
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdUser, setCreatedUser] = useState<{
    usuario: string;
    senha: string;
    nome: string;
  } | null>(null);
  const [biSubcategories, setBiSubcategories] = useState<string[]>([]);

  const allSectors = useMemo(() => sectors.map((s) => s.title), []);
  const biSector = useMemo(() => sectors.find((s) => s.slug === "bi"), []);
  const isBiSelected = selSectors.includes(normalize("Portal de BI"));

  useEffect(() => {
    loadBISubcategories().then(setBiSubcategories);
  }, []);

  const generateUsername = () => {
    const base = (first + "." + last).trim().toLowerCase().replace(/\s+/g, ".");
    const safe = base || email.split("@")[0] || "usuario";
    setUsername(safe.normalize("NFD").replace(/[^\w.]+/g, ""));
  };

  const toggleSector = (name: string) => {
    const key = normalize(name);
    setSelSectors((prev) =>
      prev.includes(key) ? prev.filter((n) => n !== key) : [...prev, key],
    );
    if (name === "Portal de BI" && !isBiSelected) {
      setSelBiSubcategories([]);
    }
  };

  const toggleBiSubcategory = (subcategory: string) => {
    setSelBiSubcategories((prev) =>
      prev.includes(subcategory)
        ? prev.filter((s) => s !== subcategory)
        : [...prev, subcategory],
    );
  };

  const checkAvailability = async (
    type: "email" | "username",
    value: string,
  ) => {
    if (!value) return;
    try {
      setChecking(true);
      const q =
        type === "email"
          ? `email=${encodeURIComponent(value)}`
          : `username=${encodeURIComponent(value)}`;
      const res = await fetch(`/api/usuarios/check-availability?${q}`);
      if (!res.ok) return;
      const data = await res.json();
      if (type === "email") setEmailTaken(!!data.email_exists);
      else setUsernameTaken(!!data.usuario_exists);
    } finally {
      setChecking(false);
    }
  };

  const strengthScore = (
    pwd: string | null,
  ): { score: number; label: string; color: string } => {
    if (!pwd) return { score: 0, label: "", color: "bg-muted" };
    let score = 0;
    const hasLower = /[a-z]/.test(pwd);
    const hasUpper = /[A-Z]/.test(pwd);
    const hasDigit = /\d/.test(pwd);
    if (pwd.length >= 6) score += 1;
    if (hasLower) score += 1;
    if (hasUpper) score += 1;
    if (hasDigit) score += 1;
    const label = score <= 2 ? "Fraca" : score === 3 ? "Média" : "Forte";
    const color =
      score <= 2
        ? "bg-red-500"
        : score === 3
          ? "bg-yellow-500"
          : "bg-green-600";
    return { score, label, color };
  };

  const fetchPassword = async () => {
    const res = await fetch(`/api/usuarios/generate-password`);
    if (!res.ok) throw new Error("Falha ao gerar senha");
    const data = await res.json();
    setGeneratedPassword(data.senha);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    await checkAvailability("email", email);
    await checkAvailability("username", username);
    if (emailTaken || usernameTaken) {
      alert("E-mail ou usuário já cadastrado.");
      return;
    }
    if (!generatedPassword) {
      alert("Clique em 'Gerar senha' antes de salvar.");
      return;
    }

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: first,
          sobrenome: last,
          usuario: username,
          email,
          senha: generatedPassword,
          nivel_acesso: level,
          setores: selSectors.length ? selSectors : null,
          bi_subcategories: selBiSubcategories.length
            ? selBiSubcategories
            : null,
          alterar_senha_primeiro_acesso: forceReset,
        }),
      });
      if (!res.ok) {
        const t = await res.json().catch(() => ({}) as any);
        const detail =
          (t && (t.detail || t.message)) || "Falha ao criar usuário";
        throw new Error(detail);
      }
      const created = await res.json();
      setCreatedUser({
        usuario: created.usuario,
        senha: created.senha,
        nome: `${created.nome} ${created.sobrenome}`,
      });
      setShowSuccess(true);
      // Notify other parts of the UI that users changed
      window.dispatchEvent(new CustomEvent("users:changed"));

      setFirst("");
      setLast("");
      setEmail("");
      setUsername("");
      setLevel("Funcionário");
      setSelSectors([]);
      setSelBiSubcategories([]);
      setForceReset(true);
      setEmailTaken(null);
      setUsernameTaken(null);
      setGeneratedPassword(null);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Não foi possível criar o usuário.");
    }
  };

  return (
    <div className="card-surface rounded-xl p-4 sm:p-6">
      <div className="text-xl font-semibold mb-2">Formulário de cadastro</div>
      <form onSubmit={submit} className="grid gap-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="first">Nome</Label>
            <Input
              id="first"
              placeholder="Digite o nome"
              value={first}
              onChange={(e) => setFirst(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="last">Sobrenome</Label>
            <Input
              id="last"
              placeholder="Digite o sobrenome"
              value={last}
              onChange={(e) => setLast(e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              placeholder="Digite o e-mail"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailTaken(null);
              }}
              onBlur={() => checkAvailability("email", email)}
            />
            {emailTaken && (
              <div className="text-xs text-destructive">
                E-mail já cadastrado
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="username">Nome de usuário</Label>
            <div className="flex gap-2">
              <Input
                id="username"
                placeholder="Digite o nome de usuário"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameTaken(null);
                }}
                onBlur={() => checkAvailability("username", username)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={generateUsername}
              >
                Gerar
              </Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Digite manualmente ou clique no botão para gerar automaticamente
            </div>
            {usernameTaken && (
              <div className="text-xs text-destructive">
                Usuário já cadastrado
              </div>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Nível de acesso</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um nível" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Coordenador">Coordenador</SelectItem>
                <SelectItem value="Gestor">Gestor</SelectItem>
                <SelectItem value="Funcionário">Funcionário</SelectItem>
                <SelectItem value="Gerente">Gerente</SelectItem>
                <SelectItem value="Gerente regional">
                  Gerente regional
                </SelectItem>
                <SelectItem value="Agente de suporte">
                  Agente de suporte
                </SelectItem>
                <SelectItem value="Administrador">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Setor(es)</Label>
            <div className="rounded-md border border-border/60 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {allSectors.map((s) => (
                <label key={s} className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border bg-background"
                    checked={selSectors.includes(normalize(s))}
                    onChange={() => toggleSector(s)}
                  />
                  {s}
                </label>
              ))}
            </div>
            {isBiSelected && biSubcategories.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Dashboards do Portal de BI
                </div>
                <div className="rounded-md border border-border/40 p-3 grid grid-cols-1 gap-2 text-sm bg-muted/30">
                  {biSubcategories.map((sub) => (
                    <label key={sub} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-background"
                        checked={selBiSubcategories.includes(sub)}
                        onChange={() => toggleBiSubcategory(sub)}
                      />
                      {sub}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={forceReset}
              onChange={(e) => setForceReset(e.target.checked)}
            />
            Solicitar alteração de senha no primeiro acesso
          </label>

          <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button type="button" variant="secondary" onClick={fetchPassword}>
              Gerar senha
            </Button>
            {generatedPassword && (
              <div className="flex-1 flex items-center gap-3">
                <div className="font-mono text-base tracking-widest px-3 py-2 rounded-md bg-muted select-all">
                  {generatedPassword}
                </div>
                {(() => {
                  const s = strengthScore(generatedPassword);
                  const width = Math.min(100, (s.score / 4) * 100);
                  return (
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 rounded bg-muted overflow-hidden">
                        <div
                          className={`${s.color} h-full`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {s.label}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={!!emailTaken || !!usernameTaken || checking}
          >
            Salvar
          </Button>
        </div>
      </form>

      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuário criado com sucesso</DialogTitle>
            <DialogDescription>
              Guarde as credenciais abaixo com segurança. Elas serão exibidas
              apenas uma vez.
            </DialogDescription>
          </DialogHeader>
          {createdUser && (
            <div className="space-y-3">
              <div className="text-sm">
                Usuário:{" "}
                <span className="font-medium">{createdUser.usuario}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-lg tracking-widest px-3 py-2 rounded-md bg-muted select-all">
                  {createdUser.senha}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const text = `Usuário: ${createdUser.usuario}\nSenha provisória: ${createdUser.senha}\n\nInstruções: acesse o sistema com estas credenciais e altere sua senha no primeiro acesso.`;
                    navigator.clipboard?.writeText(text);
                  }}
                  className="inline-flex items-center gap-2"
                >
                  <Copy className="h-4 w-4" /> Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                No primeiro acesso, será solicitado que a senha seja alterada.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Bloqueios() {
  type ApiUser = {
    id: number;
    nome: string;
    sobrenome: string;
    usuario: string;
    email: string;
    nivel_acesso: string;
    setor: string | null;
    setores?: string[] | null;
    bloqueado?: boolean;
  };
  const [blocked, setBlocked] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/usuarios/blocked")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data: ApiUser[]) => setBlocked(Array.isArray(data) ? data : []))
      .catch(() => setBlocked([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("users:changed", onChanged as EventListener);
    return () =>
      window.removeEventListener("users:changed", onChanged as EventListener);
  }, []);

  const unblock = async (id: number) => {
    const res = await fetch(`/api/usuarios/${id}/unblock`, { method: "POST" });
    if (res.ok) {
      // notify other parts of the UI
      window.dispatchEvent(new CustomEvent("users:changed"));
      load();
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-surface rounded-xl p-4">
        <div className="font-semibold mb-2">Usuários bloqueados</div>
        {loading && (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        )}
        {!loading && blocked.length === 0 && (
          <div className="text-sm text-muted-foreground">Nenhum bloqueio.</div>
        )}
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocked.map((u) => (
          <div
            key={u.id}
            className="rounded-xl border border-border/60 bg-card overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between">
              <div className="font-semibold">
                {u.nome} {u.sobrenome}
              </div>
              <span className="text-xs rounded-full px-2 py-0.5 bg-secondary">
                {u.nivel_acesso}
              </span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="text-muted-foreground">Usuário</div>
              <div className="text-right">{u.usuario}</div>
              <div className="text-muted-foreground">E-mail</div>
              <div className="text-right">{u.email}</div>
            </div>
            <div className="px-4 pb-4 flex gap-2 justify-end">
              <Button type="button" onClick={() => unblock(u.id)}>
                Desbloquear
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Permissoes() {
  type ApiUser = {
    id: number;
    nome: string;
    sobrenome: string;
    usuario: string;
    email: string;
    nivel_acesso: string;
    setor: string | null;
    setores?: string[] | null;
    bloqueado?: boolean;
  };
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [pwdDialog, setPwdDialog] = useState<{
    user: ApiUser | null;
    pwd: string | null;
  }>({ user: null, pwd: null });

  const [editNome, setEditNome] = useState("");
  const [editSobrenome, setEditSobrenome] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editUsuario, setEditUsuario] = useState("");
  const [editNivel, setEditNivel] = useState("Funcionário");
  const [editSetores, setEditSetores] = useState<string[]>([]);
  const [editBiSubcategories, setEditBiSubcategories] = useState<string[]>([]);
  const [editForceReset, setEditForceReset] = useState<boolean>(false);
  const [biSubcategories, setBiSubcategories] = useState<string[]>([]);

  const allSectors = useMemo(() => sectors.map((s) => s.title), []);
  const biSector = useMemo(() => sectors.find((s) => s.slug === "bi"), []);
  const isEditBiSelected = editSetores.includes(normalize("Portal de BI"));

  const toggleEditSector = (name: string) => {
    const key = normalize(name);
    setEditSetores((prev) =>
      prev.includes(key) ? prev.filter((n) => n !== key) : [...prev, key],
    );
    if (name === "Portal de BI" && !isEditBiSelected) {
      setEditBiSubcategories([]);
    }
  };

  const toggleEditBiSubcategory = (subcategory: string) => {
    setEditBiSubcategories((prev) =>
      prev.includes(subcategory)
        ? prev.filter((s) => s !== subcategory)
        : [...prev, subcategory],
    );
  };

  const load = () => {
    setLoading(true);
    fetch("/api/usuarios")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fail"))))
      .then((data: ApiUser[]) => {
        if (Array.isArray(data)) setUsers(data.filter((u) => !u.bloqueado));
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBISubcategories().then(setBiSubcategories);
  }, []);

  useEffect(() => {
    load();
    const onChanged = () => load();
    window.addEventListener("users:changed", onChanged as EventListener);
    return () =>
      window.removeEventListener("users:changed", onChanged as EventListener);
  }, []);

  const openEdit = (u: ApiUser) => {
    setEditing(u);
    setEditNome(u.nome);
    setEditSobrenome(u.sobrenome);
    setEditEmail(u.email);
    setEditUsuario(u.usuario);
    setEditNivel(u.nivel_acesso);
    if (u.setores && Array.isArray(u.setores) && u.setores.length > 0) {
      setEditSetores(u.setores.map((x) => normalize(String(x))));
    } else {
      setEditSetores(u.setor ? [normalize(u.setor)] : []);
    }
    setEditBiSubcategories((u as any).bi_subcategories || []);
    setEditForceReset(false);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const payload = {
      nome: editNome,
      sobrenome: editSobrenome,
      email: editEmail,
      usuario: editUsuario,
      nivel_acesso: editNivel,
      setores: editSetores,
      bi_subcategories: editBiSubcategories.length ? editBiSubcategories : null,
      alterar_senha_primeiro_acesso: editForceReset,
    };

    console.log(
      "[ADMIN] Salvando usuário",
      editing.id,
      "com payload:",
      payload,
    );

    const res = await fetch(`/api/usuarios/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    console.log("[ADMIN] Response status:", res.status);

    if (res.ok) {
      const responseData = await res.json();
      console.log("[ADMIN] User updated successfully, response:", responseData);
      console.log(
        "[ADMIN] bi_subcategories saved as:",
        responseData.bi_subcategories,
      );
      setEditing(null);
      load();

      // Dispatch event immediately to notify other listeners
      window.dispatchEvent(new CustomEvent("users:changed"));

      // Force a synchronous refresh with a slight delay to ensure backend processed
      setTimeout(() => {
        console.log("[ADMIN] Forcing auth:refresh event for user", editing.id);
        // Emit the custom event that listeners in useAuth are waiting for
        window.dispatchEvent(new CustomEvent("auth:refresh"));

        // Also emit a more specific event with the updated user info
        window.dispatchEvent(
          new CustomEvent("user:updated", {
            detail: { user_id: editing.id, type: "permissions_changed" },
          }),
        );
      }, 100);
    } else {
      const t = await res.json().catch(() => ({}) as any);
      console.error("[ADMIN] Save failed with status", res.status, "error:", t);
      alert((t && (t.detail || t.message)) || "Falha ao salvar");
    }
  };

  const regeneratePwd = async (u: ApiUser) => {
    const res = await fetch(`/api/usuarios/${u.id}/generate-password`, {
      method: "POST",
    });
    if (!res.ok) {
      alert("Falha ao gerar senha");
      return;
    }
    const data = await res.json();
    setPwdDialog({ user: u, pwd: data.senha });
    // Notify user list that user was updated (alterar_senha_primeiro_acesso set on server)
    window.dispatchEvent(new CustomEvent("users:changed"));
  };

  const blockUser = async (u: ApiUser) => {
    const res = await fetch(`/api/usuarios/${u.id}/block`, { method: "POST" });
    if (res.ok) {
      // remove locally and notify blocked list
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      window.dispatchEvent(new CustomEvent("users:changed"));
    }
  };

  const deleteUser = async (u: ApiUser) => {
    if (!confirm(`Excluir o usuário ${u.nome}?`)) return;
    const res = await fetch(`/api/usuarios/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      window.dispatchEvent(new CustomEvent("users:changed"));
    }
  };

  return (
    <div className="space-y-3">
      <div className="card-surface rounded-xl p-4">
        <div className="font-semibold mb-2">Permissões</div>
        <p className="text-muted-foreground text-sm">
          Liste e gerencie os usuários cadastrados.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {loading && (
          <div className="text-sm text-muted-foreground">Carregando...</div>
        )}
        {!loading && users.length === 0 && (
          <div className="text-sm text-muted-foreground">
            Nenhum usuário encontrado.
          </div>
        )}
        {users.map((u) => (
          <div key={u.id} className="card-surface rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border/60 bg-muted/30 flex items-center justify-between">
              <div className="font-semibold">
                {u.nome} {u.sobrenome}
              </div>
              <span className="text-xs rounded-full px-2 py-0.5 bg-secondary">
                {u.nivel_acesso}
              </span>
            </div>

            <div className="p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-x-6">
                <div className="text-muted-foreground">Usuário</div>
                <div className="text-right font-medium">{u.usuario}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="text-muted-foreground">E-mail</div>
                <div className="text-right">{u.email}</div>
              </div>
              <div className="grid grid-cols-2 gap-x-6">
                <div className="text-muted-foreground">Setor</div>
                <div className="text-right">
                  {matchSectorTitle((u.setores && u.setores[0]) || u.setor) ||
                    "—"}
                </div>
              </div>
            </div>

            <div className="px-4 pb-4 flex flex-wrap gap-2 justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => openEdit(u)}
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => regeneratePwd(u)}
              >
                Nova senha
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => blockUser(u)}
              >
                Bloquear
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={async () => {
                  if (!confirm(`Deslogar o usuário ${u.nome}?`)) return;
                  try {
                    const res = await fetch(`/api/usuarios/${u.id}/logout`, {
                      method: "POST",
                    });
                    if (!res.ok) throw new Error("Falha ao deslogar");
                    window.dispatchEvent(new CustomEvent("users:changed"));
                    window.dispatchEvent(new CustomEvent("auth:refresh"));
                    alert("Usuário deslogado com sucesso.");
                  } catch (e: any) {
                    alert(e?.message || "Erro ao deslogar usuário");
                  }
                }}
              >
                Deslogar
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => deleteUser(u)}
              >
                Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize os dados e salve.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Sobrenome</Label>
                <Input
                  value={editSobrenome}
                  onChange={(e) => setEditSobrenome(e.target.value)}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Usuário</Label>
                <Input
                  value={editUsuario}
                  onChange={(e) => setEditUsuario(e.target.value)}
                />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Nível de acesso</Label>
                <Select value={editNivel} onValueChange={setEditNivel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um nível" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Coordenador">Coordenador</SelectItem>
                    <SelectItem value="Gestor">Gestor</SelectItem>
                    <SelectItem value="Funcionário">Funcionário</SelectItem>
                    <SelectItem value="Gerente">Gerente</SelectItem>
                    <SelectItem value="Gerente regional">
                      Gerente regional
                    </SelectItem>
                    <SelectItem value="Agente de suporte">
                      Agente de suporte
                    </SelectItem>
                    <SelectItem value="Administrador">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Setor(es)</Label>
                <div className="text-xs text-muted-foreground bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-2 mb-2">
                  ℹ️ As permissões marcadas abaixo são as permissões atuais do
                  usuário
                </div>
                <div className="rounded-md border border-border/60 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {allSectors.map((s) => (
                    <label key={s} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border bg-background"
                        checked={editSetores.includes(normalize(s))}
                        onChange={() => toggleEditSector(s)}
                      />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
                {isEditBiSelected && biSubcategories.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs font-medium text-muted-foreground mb-2">
                      Dashboards do Portal de BI
                    </div>
                    <div className="rounded-md border border-border/40 p-3 grid grid-cols-1 gap-2 text-sm bg-muted/30">
                      {biSubcategories.map((sub: any) => (
                        <label
                          key={sub.dashboard_id}
                          className="inline-flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border bg-background"
                            checked={editBiSubcategories.includes(
                              sub.dashboard_id,
                            )}
                            onChange={() =>
                              toggleEditBiSubcategory(sub.dashboard_id)
                            }
                          />
                          <div>
                            <div className="font-medium">{sub.title}</div>
                            <div className="text-xs text-muted-foreground">
                              ID: {sub.dashboard_id}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border"
                checked={editForceReset}
                onChange={(e) => setEditForceReset(e.target.checked)}
              />
              Solicitar alteração de senha no próximo acesso
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditing(null)}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={saveEdit}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!pwdDialog.user}
        onOpenChange={(o) => !o && setPwdDialog({ user: null, pwd: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova senha gerada</DialogTitle>
            <DialogDescription>
              Guarde a senha com segurança. Ela será exibida apenas uma vez.
            </DialogDescription>
          </DialogHeader>
          {pwdDialog.pwd && (
            <div className="flex items-center gap-3">
              <div className="font-mono text-lg tracking-widest px-3 py-2 rounded-md bg-muted select-all">
                {pwdDialog.pwd}
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  navigator.clipboard?.writeText(pwdDialog.pwd || "")
                }
                className="inline-flex items-center gap-2"
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function Agentes() {
  const agentes = usuariosMock.filter((u) => u.perfil === "Agente");
  return (
    <div className="card-surface rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">Agentes de Suporte</div>
      <ul className="space-y-2">
        {agentes.map((a) => (
          <li key={a.id}>
            {a.nome} — {a.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Grupos() {
  return (
    <div className="card-surface rounded-xl p-4 text-sm">
      <div className="font-semibold mb-2">Grupos de Usuários</div>
      <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
        <li>Administradores</li>
        <li>Agentes N1</li>
        <li>Agentes N2</li>
        <li>Gestores</li>
      </ul>
    </div>
  );
}
