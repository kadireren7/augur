/** Illustrated species emblems; never presented as camera footage. */
export function CreatureArt({ species, className = "" }: { species: string; className?: string }) {
  const fish = species.toLowerCase() === "fish";
  const turtle = species.toLowerCase() === "turtle";
  return <svg className={`creature-art ${className}`} viewBox="0 0 320 260" fill="none" aria-hidden="true">
    <circle cx="160" cy="130" r="109" stroke="currentColor" opacity=".15" />
    <circle cx="160" cy="130" r="92" stroke="currentColor" strokeDasharray="2 9" opacity=".35" />
    <path d="M160 9v17m0 208v17M40 130H23m274 0h-17" stroke="currentColor" />
    {fish ? <g stroke="currentColor" strokeWidth="1.8"><path d="M76 132c45-62 102-59 140 0-38 59-95 62-140 0Z" fill="currentColor" fillOpacity=".07"/><path d="m216 132 38-34v68l-38-34ZM131 92l37-27 16 29M133 172l35 22 13-24M111 105c19 14 19 41 0 54M146 107l32 25-32 25"/><circle cx="99" cy="127" r="4" fill="currentColor"/></g> : turtle ? <g stroke="currentColor" strokeWidth="1.8"><ellipse cx="160" cy="138" rx="57" ry="66" fill="currentColor" fillOpacity=".07"/><path d="m138 77 3-23c2-20 36-20 38 0l3 23M107 104l-26-5-9 25 30 7m111-27 26-5 9 25-30 7M114 180l-18 28 22 9 21-17m67-20 18 28-22 9-21-17M146 202l14 20 14-20M137 110h46l17 40-40 31-40-31 17-40ZM137 110l-12-24m58 24 12-24m5 64 16 8m-96-8-16 8m56 23v22"/><circle cx="151" cy="57" r="2"/><circle cx="169" cy="57" r="2"/></g> : <g stroke="currentColor" strokeWidth="1.8"><circle cx="112" cy="86" r="26" fill="currentColor" fillOpacity=".07"/><circle cx="207" cy="86" r="26" fill="currentColor" fillOpacity=".07"/><path d="M110 105c-8-51 28-13 50-13s58-38 50 13c15 26 30 67 3 92-23 22-83 22-106 0-27-25-12-66 3-92Z" fill="currentColor" fillOpacity=".09"/><path d="M115 137c-9 23-6 43 11 48m79-48c9 23 6 43-11 48M151 163l9 8 9-8h-18Zm9 8v10m0 0-12 6m12-6 12 6M98 166l-25-6m25 17-25 7m149-18 25-6m-25 17 25 7"/><circle cx="133" cy="142" r="5" fill="currentColor"/><circle cx="187" cy="142" r="5" fill="currentColor"/></g>}
    <path d="m153 23 7-7 7 7-7 7-7-7Z" fill="currentColor" />
  </svg>;
}
