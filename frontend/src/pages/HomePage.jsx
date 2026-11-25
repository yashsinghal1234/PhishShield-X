import React from 'react';
import { useNavigate } from 'react-router-dom';
import GnosisSteppedDither from '../components/GnosisSteppedDither';
import ThreatToCertaintyWire from '../components/ThreatToCertaintyWire';
import LinguisticLimitsSection from '../components/LinguisticLimitsSection';
import UniqodeBentoCollage from '../components/UniqodeBentoCollage';
import KeyValuesAndPerformanceSection from '../components/KeyValuesAndPerformanceSection';

export default function HomePage() {
  const navigate = useNavigate();

  const handleLaunchScan = () => {
    navigate('/url');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-16 pb-0 font-['Plus_Jakarta_Sans'] animate-in fade-in duration-300">
      
      {/* =========================================================================
          HERO SECTION: PHISHSHIELD FULL STACK THREAT INTELLIGENCE
          ========================================================================= */}
      <section className="pt-2 sm:pt-4 overflow-hidden bg-[#080A0F] text-white">
        
        {/* Hero Title & Subtitle - Aligned flush with the left side of the box and navbar */}
        <div className="w-full mb-3.5 sm:mb-4.5">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-[62px] font-bold tracking-tight text-white leading-[1.08] mb-2.5">
            Multi-Modal Threat Intelligence
          </h1>
          <p className="text-base sm:text-xl md:text-2xl lg:text-[26px] font-normal text-[#94A3B8] tracking-tight max-w-none whitespace-normal md:whitespace-nowrap">
            Evidential neural detection for URLs, physical QR codes, and email spoofing
          </p>
        </div>

        {/* The Geometric Stepped Staircase Container - Aligned flush with the text and navbar */}
        <div className="relative w-full overflow-hidden bg-[#080A0F]">
          <GnosisSteppedDither height={420} />
        </div>

      </section>

      {/* =========================================================================
          SECTION 2: ADVERSARIAL THREAT TO MATHEMATICAL CERTAINTY PROCESS WIRE
          Curated editorial artwork inspired by the iconic non-linear design graphic
          ========================================================================= */}
      <ThreatToCertaintyWire />

      {/* =========================================================================
          SECTION 3: LINGUISTIC LIMITS EDITORIAL ARTWORK SECTION (NOT A CARD)
          ========================================================================= */}
      <LinguisticLimitsSection />

      {/* =========================================================================
          SECTION 4: THE SIGNATURE 7-CARD UNIQODE BENTO COLLAGE
          ========================================================================= */}
      <section className="relative mx-0 sm:-mx-4 md:-mx-6 lg:-mx-8 xl:-mx-10 px-0 sm:px-4">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#0047FF]/10 dark:bg-[#0047FF]/15 blur-[120px] rounded-full pointer-events-none -z-10" />
        <UniqodeBentoCollage onLaunchScan={handleLaunchScan} />
      </section>

      {/* =========================================================================
          SECTION 5: ARCHITECTURAL KEY VALUES & EVIDENTIAL PERFORMANCE HISTOGRAM
          (Positioned directly in between the cards and the footer)
          ========================================================================= */}
      <KeyValuesAndPerformanceSection />

    </div>
  );
}
