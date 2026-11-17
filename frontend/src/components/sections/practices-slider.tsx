"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/layout/container";
import { practices } from "@/data/practices";
import { ArrowLeft, ArrowRight } from "lucide-react";

export function PracticesSlider() {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      const card = scrollRef.current.children[index] as HTMLElement;
      if (card) {
        scrollRef.current.scrollTo({
          left: card.offsetLeft - 24,
          behavior: "smooth",
        });
      }
    }
    setCurrentIndex(index);
  };

  const handlePrev = () => {
    const nextIdx = Math.max(0, currentIndex - 1);
    scrollToIndex(nextIdx);
  };

  const handleNext = () => {
    const nextIdx = Math.min(practices.length - 1, currentIndex + 1);
    scrollToIndex(nextIdx);
  };

  const handleScroll = () => {
    if (scrollRef.current) {
      const scrollLeft = scrollRef.current.scrollLeft;
      const cardWidth = scrollRef.current.firstElementChild
        ? (scrollRef.current.firstElementChild as HTMLElement).offsetWidth + 24
        : 440;
      const newIdx = Math.round(scrollLeft / cardWidth);
      if (newIdx !== currentIndex && newIdx >= 0 && newIdx < practices.length) {
        setCurrentIndex(newIdx);
      }
    }
  };

  return (
    <section className="border-b border-[#e2d5c1] bg-[#f4efe6] py-20 lg:py-28 overflow-hidden">
      <Container size="xl">
        {/* Section Header: Headline on Left, Subhead & Controls on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end justify-between mb-12 sm:mb-16">
          <div className="md:col-span-7">
            <h2 className="font-serif text-[38px] sm:text-[50px] lg:text-[62px] leading-[0.98] tracking-[-0.04em] font-normal text-[#2a1c12]">
              Explore legal topics, <span className="text-[#9a6a35]">find counsel.</span>
            </h2>
          </div>

          <div className="md:col-span-5 flex flex-col sm:flex-row sm:items-end justify-between gap-6 md:pl-6">
            <p className="text-[15px] sm:text-[16px] text-[#5b4a3b] leading-[1.55] max-w-sm">
              Every legal domain is supported by Bar Council-verified advocates with transparent consultation pricing stated up front.
            </p>

            {/* Slider Arrow Controls */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="p-3 border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] disabled:opacity-35 hover:bg-[#ebe1d1] transition-colors cursor-pointer disabled:cursor-not-allowed rounded-[2px]"
                aria-label="Previous practice card"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex >= practices.length - 1}
                className="p-3 border border-[#e2d5c1] bg-[#fffaf2] text-[#2a1c12] disabled:opacity-35 hover:bg-[#ebe1d1] transition-colors cursor-pointer disabled:cursor-not-allowed rounded-[2px]"
                aria-label="Next practice card"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Carousel Viewport with Immersive Full-Bleed Cards */}
        <div className="overflow-visible">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-6 overflow-x-auto snap-x snap-mandatory scroll-smooth hide-scrollbar pb-6"
          >
            {practices.map((practice) => {
              return (
                <Link
                  key={practice.id}
                  href={`/practices#${practice.slug}`}
                  className="group relative w-[85vw] sm:w-[380px] lg:w-[420px] aspect-[3/4.2] shrink-0 snap-start rounded-[2px] overflow-hidden border border-[#e2d5c1] flex flex-col justify-between p-6 sm:p-8 shadow-[0_8px_30px_rgba(42,28,18,0.06)] hover:border-[#9a6a35] transition-all cursor-pointer"
                >
                  {/* Full-Bleed Photographic Background */}
                  <div className="absolute inset-0 z-0">
                    <Image
                      src={practice.image || "https://images.unsplash.com/photo-1453733197781-79dfb8c54146?auto=format&fit=crop&q=80&w=800"}
                      alt={practice.title}
                      fill
                      sizes="(max-width: 600px) 85vw, 420px"
                      className="object-cover object-center filter contrast-[1.03] transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Atmospheric Multi-stop Dark Gradient Overlay for High Text Legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140b06] via-[#140b06]/85 via-50% to-[#140b06]/20 transition-opacity" />
                  </div>

                  {/* Top Badges */}
                  <div className="relative z-10 flex items-center justify-between">
                    <span className="px-2.5 py-1 bg-[#fffaf2]/95 backdrop-blur-xs border border-[#e2d5c1] text-xs font-mono font-medium text-[#2a1c12] rounded-[1px] shadow-xs">
                      {practice.num}
                    </span>
                    <span className="px-3 py-1 bg-[#fffaf2]/95 backdrop-blur-xs border border-[#e2d5c1] text-xs font-mono font-medium text-[#2a1c12] rounded-[1px] shadow-xs">
                      {practice.startingFee}
                    </span>
                  </div>

                  {/* Bottom Text Overlay */}
                  <div className="relative z-10 space-y-3 pt-12">
                    <h3 className="font-serif text-[28px] sm:text-[32px] font-normal leading-[1.1] text-[#fffaf2] group-hover:text-[#d1a46a] transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
                      {practice.title}
                    </h3>
                    <p className="text-[13.5px] sm:text-[14px] leading-[1.55] text-[#f3ece1] drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                      {practice.tagline}
                    </p>

                    <div className="pt-3 border-t border-white/25 flex items-center justify-between text-xs">
                      <span className="text-[#d1a46a] font-medium font-sans truncate max-w-[210px] group-hover:text-[#f3d3a3] transition-colors">
                        {practice.partnerNames}
                      </span>
                      <span className="text-[#f3ece1]/85 font-mono text-[11px] truncate max-w-[160px] text-right">
                        {practice.feeType}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Position Indicator Dots */}
        <div className="mt-6 flex justify-center space-x-2">
          {practices.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => scrollToIndex(idx)}
              className={`h-1.5 transition-all cursor-pointer rounded-full ${
                idx === currentIndex ? "w-8 bg-[#2a1c12]" : "w-2 bg-[#e2d5c1] hover:bg-[#85725f]"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
