import React from 'react';
import UniqodeLogo from './UniqodeLogo';
import PixelPadlock from './PixelPadlock';
import PantomPlusCard from './PantomPlusCard';
import PixelWorldMap from './PixelWorldMap';
import CipherTypeSpecimen from './CipherTypeSpecimen';

/**
 * UniqodeBentoCollage:
 * Exact pixel-for-pixel mathematical recreation of the 7-card Uniqode brand collage:
 * 1. Card 1 (Top Left, cols 1-8): Blue "Everything, Everywhere, All at Once." + "■ LET'S GET STARTED" + "PHISHSHIELD.COM"
 * 2. Card 2 (Top Right, cols 9-12): Light gray halftone grid with animated satellite & signal beam
 * 3. Card 3 (Middle Left, cols 1-4): White card with dense cross-stitch matrix (+, ×, ·) and ripple pulse
 * 4. Card 4 (Middle Center, cols 5-8): Blue card with geometric flower loop logo + "PHISHSHIELD"
 * 5. Card 5 (Middle Right, cols 9-12): Pitch black card with typography specimen encrypting & decrypting
 * 6. Card 6 (Bottom Left, cols 1-4): Ice blue card with "SECURITY" & pixel padlock
 * 7. Card 7 (Bottom Right, cols 5-12): Pitch black card with ice blue "IRL TO URL & BACK AGAIN"
 */
export default function UniqodeBentoCollage({ onLaunchScan }) {
  return (
    <div className="w-full max-w-[1360px] mx-auto select-none font-['Plus_Jakarta_Sans']">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 sm:gap-3.5">
        
        {/* =========================================================================
            ROW 1
            ========================================================================= */}

        {/* CARD 1: Everything, Everywhere, All at Once. (Cols 1-8) */}
        <div className="md:col-span-8 rounded-[24px] bg-[#0047FF] p-6 sm:p-8 md:p-9 text-white flex flex-col justify-between min-h-[290px] sm:min-h-[330px] md:min-h-[370px] lg:min-h-[395px] shadow-lg shadow-[#0047FF]/20 relative overflow-hidden group">
          {/* Subtle dot matrix overlay */}
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none bg-[radial-gradient(circle_at_center,_#ffffff_1.2px,_transparent_1.2px)] bg-[size:16px_16px]" />

          {/* Main Pixel Headline - Bold, Expanded Width & Size */}
          <div className="relative z-10 pt-1">
            <h1 className="font-['Pixelify_Sans'] text-4xl sm:text-5xl md:text-[62px] lg:text-[74px] xl:text-[82px] font-bold tracking-[0.025em] leading-[1.01] text-white">
              Everything,<br />
              Everywhere,<br />
              All at Once.
            </h1>
          </div>

          {/* Bottom Row: ■ LET'S GET STARTED and PHISHSHIELD.COM */}
          <div className="relative z-10 pt-4 flex items-center justify-between text-white/90">
            <button
              onClick={onLaunchScan}
              type="button"
              className="inline-flex items-center gap-2 font-['Silkscreen'] text-[11px] sm:text-[12px] tracking-[0.16em] uppercase font-bold hover:text-white hover:underline transition-colors cursor-pointer"
            >
              <span>■ LET'S GET STARTED</span>
            </button>

            <span className="font-['Silkscreen'] text-[10px] sm:text-[11px] tracking-[0.16em] uppercase text-white/80">
              PHISHSHIELD.COM
            </span>
          </div>
        </div>

        {/* CARD 2: Editorial Plus Matrix & Telemetry (Cols 9-12) */}
        <div className="md:col-span-4 rounded-[24px] bg-[#0A0D14] border border-[#1A1E29] flex items-center justify-center min-h-[290px] sm:min-h-[330px] md:min-h-[370px] lg:min-h-[395px] shadow-sm relative overflow-hidden">
          <PantomPlusCard onLaunchScan={onLaunchScan} />
        </div>

        {/* =========================================================================
            ROW 2
            ========================================================================= */}

        {/* CARD 3: Dotted Vector World Map Telemetry (Cols 1-4) */}
        <div className="md:col-span-4 rounded-[24px] bg-[#0A0D14] border border-[#1A1E29] p-2.5 sm:p-3 flex items-center justify-center min-h-[165px] sm:min-h-[185px] shadow-sm relative overflow-hidden">
          <PixelWorldMap />
        </div>

        {/* CARD 4: Blue Card with White Flower Loop Logo + PHISHSHIELD (Cols 5-8) */}
        <div className="md:col-span-4 rounded-[24px] bg-[#0047FF] text-white p-5 flex items-center justify-center min-h-[165px] sm:min-h-[185px] shadow-md shadow-[#0047FF]/15">
          <div className="flex items-center gap-3">
            {/* Preserved exact Uniqode geometric flower/knot loop logo */}
            <UniqodeLogo size={42} showText={false} light={true} />
            <span className="font-['Plus_Jakarta_Sans'] text-xl sm:text-2xl font-extrabold tracking-[0.24em] uppercase text-white">
              PHISHSHIELD
            </span>
          </div>
        </div>

        {/* CARD 5: Pitch Black Dynamic Encrypting/Decrypting Typography Specimen (Cols 9-12) */}
        <div className="md:col-span-4 rounded-[24px] bg-[#0A0D14] text-white p-5 sm:p-6 flex flex-col justify-center min-h-[165px] sm:min-h-[185px] shadow-md border border-[#1A1E29] overflow-hidden">
          <CipherTypeSpecimen />
        </div>

        {/* =========================================================================
            ROW 3
            ========================================================================= */}

        {/* CARD 6: Light Ice Blue "SECURITY" Padlock Card (Cols 1-4) */}
        <div className="md:col-span-4 rounded-[24px] bg-[#9BBFE0] p-5 sm:p-6 text-[#0A0D14] flex flex-col items-center justify-between min-h-[240px] sm:min-h-[265px] shadow-sm">
          <span className="font-['Plus_Jakarta_Sans'] text-xs font-extrabold tracking-[0.25em] uppercase text-[#0A0D14]">
            SECURITY
          </span>

          <div className="my-auto py-2">
            <PixelPadlock size={82} color="#0A0D14" />
          </div>

          <div className="h-2" />
        </div>

        {/* CARD 7: Pitch Black "IRL TO URL & BACK AGAIN" (Cols 5-12) */}
        <div className="md:col-span-8 rounded-[24px] bg-[#0A0D14] text-white p-6 sm:p-8 flex items-center justify-center min-h-[240px] sm:min-h-[265px] shadow-lg border border-[#1A1E29]">
          <h2 className="font-['Pixelify_Sans'] text-4xl sm:text-5xl md:text-6xl lg:text-[68px] font-bold tracking-tight text-[#9BBFE0] leading-[1.12] text-center">
            IRL TO<br />
            URL &amp; BACK<br />
            AGAIN
          </h2>
        </div>

      </div>
    </div>
  );
}
