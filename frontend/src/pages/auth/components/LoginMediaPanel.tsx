import { useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { apiFetch } from "@/lib/api";

type MediaKind = "image" | "video";

interface MediaItem {
  id: string | number;
  type: MediaKind;
  url?: string;
  mime?: string;
}

async function fetchLoginMedia(signal?: AbortSignal): Promise<MediaItem[]> {
  try {
    const res = await apiFetch("/login-media", { signal });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export default function LoginMediaPanel() {
  const defaultItems: MediaItem[] = [
    {
      id: "default-1",
      type: "image",
      url: "https://cdn.builder.io/api/v1/image/assets%2Ffebea1b69437410ebd88e454001ca510%2Fe38b6c90873e4ea48f163db39b62fff9?format=webp&width=1600",
    },
    {
      id: "default-2",
      type: "image",
      url: "https://cdn.builder.io/api/v1/image/assets%2Ffebea1b69437410ebd88e454001ca510%2F3a4a4f300e384651b805810074ea77d3?format=webp&width=1600",
    },
  ];

  const [items, setItems] = useState<MediaItem[]>(defaultItems);
  const [loadedVideos, setLoadedVideos] = useState<Set<string | number>>(
    new Set(),
  );
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: true,
    align: "center",
    skipSnaps: false,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoListenersRef = useRef<Map<number, () => void>>(new Map());

  useEffect(() => {
    const controller = new AbortController();
    fetchLoginMedia(controller.signal).then((list) => {
      if (list.length > 0) {
        console.log("Media loaded:", list);
        setItems(list);
      }
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }

      const idx = emblaApi.selectedScrollSnap();
      const item = items[idx];

      // Clean up old listeners
      videoListenersRef.current.forEach((cleanup) => cleanup());
      videoListenersRef.current.clear();

      if (item?.type === "video") {
        const slides = emblaApi.slideNodes();
        const video = slides[idx]?.querySelector(
          "video",
        ) as HTMLVideoElement | null;

        if (video) {
          // Reset and play video
          video.currentTime = 0;
          const playPromise = video.play();

          if (playPromise !== undefined) {
            playPromise.catch((error) => {
              console.error("Video play failed:", error);
              // If autoplay fails, skip to next after 6 seconds
              timeoutRef.current = setTimeout(
                () => emblaApi.scrollNext(),
                6000,
              );
            });
          }

          const handleEnd = () => {
            console.log("Video ended, moving to next");
            emblaApi.scrollNext();
          };

          video.addEventListener("ended", handleEnd);
          videoListenersRef.current.set(idx, () =>
            video.removeEventListener("ended", handleEnd),
          );
        }
      } else {
        // Image: auto-advance after 6 seconds
        timeoutRef.current = setTimeout(() => emblaApi.scrollNext(), 6000);
      }
    };

    onSelect();
    emblaApi.on("select", onSelect);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      videoListenersRef.current.forEach((cleanup) => cleanup());
      videoListenersRef.current.clear();
    };
  }, [emblaApi, items]);

  const handleVideoLoaded = (itemId: string | number) => {
    setLoadedVideos((prev) => new Set(prev).add(itemId));
    console.log("Video loaded:", itemId);
  };

  const handleVideoError = (itemId: string | number, error: any) => {
    console.error("Video error for item", itemId, error);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl mx-auto w-[360px] h-[360px] sm:w-[460px] sm:h-[460px] md:w-[520px] md:h-[520px] lg:w-[560px] lg:h-[560px] xl:w-[640px] xl:h-[640px]">
      <div className="absolute inset-0 brand-gradient opacity-70" />
      <div className="relative h-full embla" ref={emblaRef}>
        <div className="embla__container flex h-full">
          {items.map((item) => (
            <div
              key={item.id}
              className="embla__slide min-w-0 flex-[0_0_100%] h-full relative"
            >
              {item.type === "image" ? (
                <img
                  src={item.url}
                  alt="Media"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    console.error("Image load error:", item.id);
                    // Fallback to placeholder if image fails
                    e.currentTarget.src = defaultItems[0].url || "";
                  }}
                />
              ) : (
                <>
                  <video
                    key={item.id}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="auto"
                    onLoadedData={() => handleVideoLoaded(item.id)}
                    onError={(e) => handleVideoError(item.id, e)}
                  >
                    <source src={item.url} type={item.mime || "video/mp4"} />
                    Your browser does not support the video tag.
                  </video>

                  {/* Loading indicator for videos */}
                  {!loadedVideos.has(item.id) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
