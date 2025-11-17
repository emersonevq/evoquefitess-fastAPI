import { useEffect, useMemo, useRef, useState } from "react";
import useEmblaCarousel, { EmblaCarouselType } from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/api";

type MediaKind = "image" | "video" | "message";

interface MediaItem {
  id: string | number;
  type: MediaKind;
  url?: string;
  title?: string;
  description?: string;
  ctaText?: string;
  ctaHref?: string;
  alt?: string;
  mime?: string;
}

async function fetchLoginMedia(signal?: AbortSignal): Promise<MediaItem[]> {
  const res = await apiFetch("/login-media", { signal });
  if (!res.ok) throw new Error("failed");
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data as MediaItem[];
}

export default function LoginMediaPanel() {
  const defaultItems: MediaItem[] = [
    {
      id: "default-1",
      type: "image",
      url: "https://cdn.builder.io/api/v1/image/assets%2Ffebea1b69437410ebd88e454001ca510%2Fe38b6c90873e4ea48f163db39b62fff9?format=webp&width=1600",
      title: "EVOQUE ACADEMIA",
      description: "no mundo da inteligência artificial",
      alt: "Evoque Academia",
    },
    {
      id: "default-2",
      type: "image",
      url: "https://cdn.builder.io/api/v1/image/assets%2Ffebea1b69437410ebd88e454001ca510%2F3a4a4f300e384651b805810074ea77d3?format=webp&width=1600",
      title: "Evoque Collection",
      description: "estilo é atitude",
      alt: "Evoque Collection",
    },
  ];

  const [items, setItems] = useState<MediaItem[]>(defaultItems);
  const [error, setError] = useState<string | null>(null);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
  });
  const autoplayRef = useRef<number | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    fetchLoginMedia(ac.signal)
      .then((list) => {
        const filtered = list.filter(Boolean);
        if (filtered.length > 0) setItems(filtered);
      })
      .catch(() => setError("failed"))
      .finally(() => ac.abort());
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;
    if (autoplayRef.current) window.clearInterval(autoplayRef.current);
    autoplayRef.current = window.setInterval(() => {
      try {
        (emblaApi as EmblaCarouselType).scrollNext();
      } catch {}
    }, 6000);
    return () => {
      if (autoplayRef.current) window.clearInterval(autoplayRef.current);
    };
  }, [emblaApi, items.length]);

  const showFallback = !items || items.length === 0 || error;

  if (showFallback) {
    return (
      <div className="relative overflow-hidden rounded-2xl mx-auto w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] md:w-[520px] md:h-[520px] lg:w-[560px] lg:h-[560px] xl:w-[640px] xl:h-[640px] brand-gradient flex items-center justify-center">
        <div className="max-w-lg text-center text-primary-foreground px-6">
          <img
            src="https://images.totalpass.com/public/1280x720/czM6Ly90cC1pbWFnZS1hZG1pbi1wcm9kL2d5bXMva2g2OHF6OWNuajloN2lkdnhzcHhhdWx4emFhbWEzYnc3MGx5cDRzZ3p5aTlpZGM0OHRvYnk0YW56azRk"
            alt="Evoque Fitness Logo"
            className="h-10 w-auto mx-auto mb-6 rounded-sm shadow-sm"
          />
          <h1 className="text-3xl font-extrabold drop-shadow">
            Evoque Fitness
          </h1>
          <p className="mt-3 text-sm/6 opacity-90">
            Acesse seu painel para gerenciar chamados e acompanhar métricas do
            setor.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl mx-auto w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] md:w-[520px] md:h-[520px] lg:w-[560px] lg:h-[560px] xl:w-[640px] xl:h-[640px]">
      <div
        className="absolute inset-0 brand-gradient opacity-70"
        aria-hidden="true"
      />
      <div className="relative h-full embla" ref={emblaRef}>
        <div className="embla__container flex h-full">
          {items.map((item) => (
            <div
              key={item.id}
              className="embla__slide min-w-0 flex-[0_0_100%] h-full"
            >
              <Slide item={item} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide({ item }: { item: MediaItem }) {
  return (
    <div className="w-full h-full relative">
      {item.type === "image" && item.url ? (
        <img
          src={item.url}
          alt={item.alt || item.title || "Imagem"}
          className="w-full h-full object-cover login-media"
        />
      ) : item.type === "video" && item.url ? (
        <video
          className="w-full h-full object-cover login-media"
          autoPlay
          muted
          loop
          playsInline
          controls={false}
          preload="metadata"
        >
          <source src={item.url} type={item.mime || "video/mp4"} />
        </video>
      ) : (
        <div className="w-full h-full flex items-center justify-center p-8">
          <div
            className={cn(
              "rounded-xl p-6 w-full max-w-md text-center",
              "bg-white/5 backdrop-blur border border-white/10 text-white",
            )}
          >
            {item.title ? (
              <h3 className="text-xl font-bold tracking-tight">{item.title}</h3>
            ) : null}
            {item.description ? (
              <p className="mt-2 text-sm/6 text-white/90">{item.description}</p>
            ) : null}
            {item.ctaHref && item.ctaText ? (
              <a
                href={item.ctaHref}
                className="inline-flex items-center justify-center mt-4 h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {item.ctaText}
              </a>
            ) : null}
          </div>
        </div>
      )}
      {(item.title || item.description) &&
      (item.type === "image" || item.type === "video") ? (
        <div className="absolute inset-x-0 bottom-0 p-6">
          <div className="max-w-xl bg-black/35 backdrop-blur rounded-lg p-4 text-white">
            {item.title ? (
              <h3 className="text-lg font-semibold">{item.title}</h3>
            ) : null}
            {item.description ? (
              <p className="mt-1 text-sm/6 text-white/90">{item.description}</p>
            ) : null}
            {item.ctaHref && item.ctaText ? (
              <a
                href={item.ctaHref}
                className="inline-flex items-center justify-center mt-3 h-9 px-4 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {item.ctaText}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
