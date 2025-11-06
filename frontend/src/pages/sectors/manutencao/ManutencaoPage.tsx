import Layout from "@/components/layout/Layout";
import { sectors } from "@/data/sectors";

const sector = sectors.find((s) => s.slug === "manutencao")!;

export default function ManutencaoPage() {
  return (
    <Layout>
      <section className="w-full">
        <div className="brand-gradient">
          <div className="container py-10 sm:py-14">
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-primary-foreground drop-shadow">
              {sector.title}
            </h1>
            <p className="mt-2 text-primary-foreground/90 max-w-2xl">
              {sector.description}
            </p>
          </div>
        </div>
      </section>

      <section className="container py-8 sm:py-12">
        <div className="rounded-xl border border-border/60 bg-card p-6 sm:p-8">
          <p className="text-muted-foreground">
            Em breve adicionaremos funcionalidades específicas para este setor.
          </p>
        </div>
      </section>
    </Layout>
  );
}
