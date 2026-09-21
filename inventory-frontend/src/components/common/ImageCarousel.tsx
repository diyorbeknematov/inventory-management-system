import {
  useState,
} from "react";

import type {
  MouseEvent,
} from "react";

import {
  Package,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

export default function ImageCarousel({
  images,
  alt,
  className = "",
}: {
  images: string[];
  alt: string;
  className?: string;
}) {
  const [currentIndex, setCurrentIndex] =
    useState(0);

  if (images.length === 0) {
    return (
      <div
        className={`relative flex items-center justify-center bg-zinc-100 ${className}`}
      >
        <Package
          size={42}
          strokeWidth={1.2}
          className="text-zinc-300"
        />
      </div>
    );
  }

  const hasMultiple =
    images.length > 1;

  const previousImage = (
    e: MouseEvent
  ) => {
    e.stopPropagation();

    setCurrentIndex(
      (prev) =>
        prev === 0
          ? images.length - 1
          : prev - 1
    );
  };

  const nextImage = (
    e: MouseEvent
  ) => {
    e.stopPropagation();

    setCurrentIndex(
      (prev) =>
        prev ===
        images.length - 1
          ? 0
          : prev + 1
    );
  };

  return (
    <div
      className={`group/carousel relative overflow-hidden bg-zinc-100 ${className}`}
    >
      <img
        src={images[currentIndex]}
        alt={alt}
        className="h-full w-full object-cover"
      />

      {hasMultiple && (
        <>
          <button
            onClick={previousImage}
            className="absolute left-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow-sm transition group-hover/carousel:opacity-100 hover:bg-white"
          >
            <ChevronLeft size={17} />
          </button>

          <button
            onClick={nextImage}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-zinc-700 opacity-0 shadow-sm transition group-hover/carousel:opacity-100 hover:bg-white"
          >
            <ChevronRight size={17} />
          </button>

          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map(
              (_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();

                    setCurrentIndex(
                      index
                    );
                  }}
                  className={`h-1.5 rounded-full transition-all ${
                    index ===
                    currentIndex
                      ? "w-4 bg-white"
                      : "w-1.5 bg-white/60"
                  }`}
                />
              )
            )}
          </div>

          <div className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium text-white">
            {currentIndex + 1}/
            {images.length}
          </div>
        </>
      )}
    </div>
  );
}