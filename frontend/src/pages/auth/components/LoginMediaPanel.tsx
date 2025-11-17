import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
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
      alt: "Evoque Academia",
    },
    {
      id: "default-2",
      type: "image",
      url: "https://cdn.builder.io/api/v1/image/assets%2Ffebea1b69437410ebd88e454001ca510%2F3a4a4f300e384651b805810074ea77d3?format=webp&width=1600",
      alt: "Evoque Collection",
    },
  ];

  const [items, setItems] = useState<MediaItem[]>(defaultItems);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  useEffect(() => {
    const ac = new AbortController();
    fetchLoginMedia(ac.signal)
      .then((list) => {
        if (list.length > 0) {
          setItems(list);
        }
      })
      .catch(() => {
        // Use default items
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const scheduleAutoplay = () => {
      try {
        // Clean up previous timeout and listeners
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        cleanupRef.current();
        cleanupRef.current = () => {};

        const currentIndex = emblaApi.selectedIndex;
        const currentItem = items[currentIndex];

        if (currentItem?.type === "video") {
          // For videos: wait for them to end
          try {
            const container = emblaApi.containerNode();
            if (!container) return;

            const slides = container.querySelectorAll(".embla__slide");
            const videoElement = slides[currentIndex]?.querySelector("video") as HTMLVideoElement | null;

            if (videoElement && videoElement.duration > 0) {
              const onVideoEnded = () => {
                emblaApi.scrollNext();
              };

              // Clean old listeners
              videoElement.removeEventListener("ended", onVideoEnded);
              // Add new listener
              videoElement.addEventListener("ended", onVideoEnded, { once: true });

              // Store cleanup function
              cleanupRef.current = () => {
                videoElement.removeEventListener("ended", onVideoEnded);
              };
            }
          } catch (error) {
            console.error("[LoginMediaPanel] Error setting up video listener:", error);
            // Fallback: advance after 6 seconds if something goes wrong
            timeoutRef.current = setTimeout(() => {
              emblaApi.scrollNext();
            }, 6000);
          }
        } else {
          // For images: advance every 6 seconds
          timeoutRef.current = setTimeout(() => {
            emblaApi.scrollNext();
          }, 6000);
        }
      } catch (error) {
        console.error("[LoginMediaPanel] Error in scheduleAutoplay:", error);
      }
    };

    try {
      scheduleAutoplay();
      const unsubscribe = emblaApi.on("select", scheduleAutoplay);

      return () => {
        unsubscribe();
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        cleanupRef.current();
      };
    } catch (error) {
      console.error("[LoginMediaPanel] Error setting up autoplay:", error);
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        cleanupRef.current();
      };
    }
  }, [emblaApi, items]);

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
              {item.type === "image" && item.url ? (
                <img
                  src={item.url}
                  alt={item.alt || "Mídia"}
                  className="w-full h-full object-cover"
                />
              ) : item.type === "video" && item.url ? (
                <video
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  playsInline
                  controls={false}
                  preload="auto"
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
                    {item.title && (
                      <h3 className="text-xl font-bold tracking-tight">
                        {item.title}
                      </h3>
                    )}
                    {item.description && (
                      <p className="mt-2 text-sm/6 text-white/90">
                        {item.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
