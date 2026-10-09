import type { ActorType } from "./types.js";

export function actorSvg(type: ActorType, color = "#2563eb"): string {
  const body =
    vehicle(type, color) ?? person(type, color) ?? vehicle("car", color)!;
  return `<svg viewBox="0 0 48 48" role="img" aria-hidden="true" focusable="false">${body}</svg>`;
}

function wheel(cx: number, cy: number, r: number): string {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#152238"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55}" fill="#c9d3df"/><circle cx="${cx}" cy="${cy}" r="${r * 0.2}" fill="#5b6b82"/>`;
}

function vehicle(type: ActorType, color: string): string | undefined {
  const dark = "#152238";
  const glass = "#cfeefe";
  const shine = `fill="#fff" opacity=".18"`;

  switch (type) {
    case "bicycle": {
      const spokes = (cx: number) =>
        `<path d="M${cx - 7} 33h14M${cx} 26v14M${cx - 5} 28l10 10M${cx + 5} 28l-10 10" stroke="#9aa7b8" stroke-width=".8"/>`;
      return `<circle cx="11" cy="33" r="8" fill="none" stroke="${dark}" stroke-width="2.5"/><circle cx="37" cy="33" r="8" fill="none" stroke="${dark}" stroke-width="2.5"/>${spokes(11)}${spokes(37)}<path d="M11 33 19 19h13l-10 14zM19 19l3 14M11 33h11M32 19l5 14" fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.5 17.5h5.5M30 15h4.5M32 19l-2-4" fill="none" stroke="${dark}" stroke-width="2.6" stroke-linecap="round"/><circle cx="22" cy="33" r="3" fill="none" stroke="#5b6b82" stroke-width="1.8"/><circle cx="11" cy="33" r="1.4" fill="#5b6b82"/><circle cx="37" cy="33" r="1.4" fill="#5b6b82"/>`;
    }

    case "motorcycle":
      return `${wheel(10, 35, 6)}${wheel(38, 35, 6)}<path d="M10 35 22 31" stroke="#5b6b82" stroke-width="2.5" stroke-linecap="round"/><path d="M38 35 32 19" stroke="#5b6b82" stroke-width="2.8" stroke-linecap="round"/><rect x="19" y="26" width="10" height="8" rx="2" fill="#4a5568"/><path d="M8 33h11" stroke="#9aa7b8" stroke-width="2.5" stroke-linecap="round"/><path d="M17 26c0-3.5 3-5.5 6.5-5l6 1 2 4.5z" fill="${color}"/><path d="M8.5 24h11c1.3 0 1.5 2 .2 2H11c-2 0-3-1.2-2.5-2z" fill="${dark}"/><path d="M30 18.5h5" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><circle cx="35.5" cy="22.5" r="2.4" fill="#ffe98a" stroke="${dark}" stroke-width=".8"/>`;

    case "scooter":
      return `${wheel(11, 36, 4.5)}${wheel(37, 36, 4.5)}<path d="M4 33v-6c0-3.5 3-5.5 7-5.5h6c1.5 0 2 1 2 2.5v9z" fill="${color}"/><path d="M4 33v-6c0-3.5 3-5.5 7-5.5h6c1.5 0 2 1 2 2.5v1.5H6z" ${shine}/><rect x="6" y="18.5" width="13" height="3.5" rx="1.7" fill="${dark}"/><rect x="19" y="31" width="14" height="3" rx="1.5" fill="${dark}" opacity=".75"/><path d="M36 33 33 16" stroke="${color}" stroke-width="4.5" stroke-linecap="round"/><path d="M29.5 15h6.5" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><circle cx="35.2" cy="21" r="2" fill="#ffe98a" stroke="${dark}" stroke-width=".8"/><path d="M33 32h9" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;

    case "bus":
      return `<rect x="2" y="9" width="42" height="25" rx="4" fill="${color}"/><rect x="2" y="9" width="42" height="8" rx="4" ${shine}/><rect x="4.5" y="13" width="5.5" height="8" rx="1" fill="${glass}"/><rect x="12" y="13" width="5.5" height="8" rx="1" fill="${glass}"/><rect x="19.5" y="13" width="5.5" height="8" rx="1" fill="${glass}"/><rect x="27" y="12" width="6" height="20" rx="1" fill="${glass}" stroke="${dark}" stroke-width=".8"/><path d="M30 12v20" stroke="${dark}" stroke-width=".8"/><path d="M35 13h6.5c1 0 1.5.6 1.5 1.5V22H35z" fill="${glass}"/><rect x="2" y="25" width="42" height="2.5" fill="#fff" opacity=".35"/><rect x="42" y="27" width="2.5" height="3" rx="1" fill="#ffe98a"/><rect x="1.5" y="27" width="2" height="3" rx="1" fill="#ff5a5a"/>${wheel(12, 34, 5)}${wheel(35, 34, 5)}`;

    case "truck":
      return `<rect x="2" y="9" width="27" height="24" rx="2" fill="${color}"/><rect x="2" y="9" width="27" height="5" rx="2" ${shine}/><path d="M7 14v15M12 14v15M17 14v15M22 14v15" stroke="#000" stroke-width=".7" opacity=".18"/><path d="M30.5 15h7c1.2 0 2.200.6 2.800 1.600L44 23c.700.400 1.500 1 1.500 2.500V33h-15z" fill="${color}"/><path d="M30.500 15h7c1.200 0 2.200.6 2.800 1.600L44 23H30.500z" fill="#000" opacity=".12"/><path d="M33 17.500h4.500c.7 0 1.200.3 1.600.9l2.200 3.600H33z" fill="${glass}"/><rect x="43.500" y="26" width="2" height="3" rx="1" fill="#ffe98a"/><rect x="2" y="33" width="43.500" height="2.500" rx="1" fill="${dark}"/>${wheel(10, 35, 5)}${wheel(19, 35, 5)}${wheel(38, 35, 5)}`;

    case "van":
      return `<path d="M3 33V15c0-1.600 1.200-2.700 2.800-2.700H28c1.500 0 2.700.7 3.500 1.900L36 21h5c2 0 3 1.500 3 3v9z" fill="${color}"/><path d="M3 33V15c0-1.600 1.200-2.700 2.800-2.700H28c1.500 0 2.700.7 3.500 1.900L33 16H3z" ${shine}/><path d="M28.500 15h1.300l4 5.500h-5.300z" fill="${glass}"/><path d="M26 15v18" stroke="${dark}" stroke-width=".8" opacity=".5"/><rect x="7" y="22" width="14" height="3" rx="1.500" fill="#fff" opacity=".4"/><rect x="42" y="25" width="2.500" height="3.500" rx="1" fill="#ffe98a"/><rect x="2.500" y="24" width="1.800" height="4" rx=".8" fill="#ff5a5a"/>${wheel(13, 34, 5)}${wheel(35, 34, 5)}`;

    default:
      // car (and any unknown type)
      return `<path d="M4 33v-5c0-2 1.300-3.200 3.200-3.600l5.800-1.400 4.300-5.400c1-1.200 2.300-1.900 3.900-1.900H30c1.500 0 2.900.7 3.800 1.800l4.500 5.500 3.200.9c2 .4 2.500 1.900 2.500 3.600V33z" fill="${color}"/><path d="M13 23.600l4.300-5.400c1-1.200 2.300-1.900 3.900-1.900H30c1.500 0 2.900.7 3.800 1.800l1.500 1.900z" ${shine}/><path d="M16.500 23l3.300-4.400c.4-.6 1-.8 1.700-.8H25V23zM27 17.800h3c.7 0 1.200.2 1.600.7L35 23H27z" fill="${glass}"/><path d="M26 17.800V33" stroke="${dark}" stroke-width=".7" opacity=".35"/><rect x="41" y="26" width="3" height="3" rx="1" fill="#ffe98a"/><rect x="4" y="26" width="2.500" height="3" rx="1" fill="#ff5a5a"/><circle cx="13" cy="34" r="6.500" fill="${dark}"/><circle cx="35" cy="34" r="6.500" fill="${dark}"/>${wheel(13, 34, 5)}${wheel(35, 34, 5)}`;
  }
}

function person(type: ActorType, color: string): string | undefined {  
  if (!["pedestrian", "human", "boy", "girl"].includes(type)) return;

  const skin = "#f4c7a1";
  const dark = "#152238";
  const pants = "#334155";
  const isGirl = type === "girl";
  const isBoy = type === "boy";
  const accent = isGirl ? "#ec4899" : isBoy ? "#22c55e" : color;
  const hair = isGirl ? "#5b3a29" : "#2b1d14";

  const shoes = `<ellipse cx="20.500" cy="43.500" rx="3.800" ry="1.800" fill="${dark}"/><ellipse cx="27.500" cy="43.500" rx="3.800" ry="1.800" fill="${dark}"/>`;
  const head = `<rect x="22" y="14" width="4" height="4" rx="1.500" fill="${skin}"/><circle cx="24" cy="9.500" r="5.500" fill="${skin}"/><circle cx="22" cy="10" r=".7" fill="${dark}"/><circle cx="26" cy="10" r=".7" fill="${dark}"/>`;
  const arms = `<path d="M16.500 19.500l-3 9.500M31.500 19.500l3 9.500" stroke="${accent}" stroke-width="4.500" stroke-linecap="round" fill="none"/><circle cx="13.200" cy="30.200" r="2.200" fill="${skin}"/><circle cx="34.800" cy="30.200" r="2.200" fill="${skin}"/>`;

  let body: string;
  if (isGirl) {
    body = `<rect x="16.500" y="4" width="15" height="17" rx="6" fill="${hair}"/>${head}<path d="M20 4.500c1.500 3 6.500 3 8.500 0c1.500 1 2 3 1.500 5c-1-2.500-3-3.800-5.500-3.800S19.500 8 18.500 9.500c-.500-2 0-4 1.500-5z" fill="${hair}"/>${arms}<path d="M19 17.500h10l5 17H14z" fill="${accent}"/><path d="M19 17.500h10l.8 3H18.200z" fill="#fff" opacity=".18"/><rect x="19" y="34" width="3.800" height="9" rx="1.500" fill="${skin}"/><rect x="25.200" y="34" width="3.800" height="9" rx="1.500" fill="${skin}"/>${shoes}`;
  } else if (isBoy) {
    body = `${head}<path d="M18.500 9.500c-.500-4 2-6.500 5.500-6.500s6 2.500 5.500 6.500c-1.500-2-3.500-2.800-5.500-2.800s-4 .8-5.500 2.800z" fill="${hair}"/>${arms}<path d="M18 17.500h12c1.700 0 2.500 1 2.500 2.500v12H15.500V20c0-1.500.8-2.500 2.500-2.500z" fill="${accent}"/><rect x="17" y="30" width="6.500" height="7.500" rx="1.500" fill="${pants}"/><rect x="24.500" y="30" width="6.500" height="7.500" rx="1.500" fill="${pants}"/><rect x="18.500" y="37" width="3.800" height="6" rx="1.500" fill="${skin}"/><rect x="25.700" y="37" width="3.800" height="6" rx="1.500" fill="${skin}"/>${shoes}`;
  } else {
    body = `${head}<path d="M18.500 9.500c-.500-4 2-6.500 5.500-6.500s6 2.500 5.500 6.500c-1.500-2-3.500-2.800-5.500-2.800s-4 .8-5.500 2.800z" fill="${hair}"/>${arms}<path d="M18 17.500h12c1.700 0 2.500 1 2.500 2.500v12H15.500V20c0-1.500.8-2.500 2.500-2.500z" fill="${accent}"/><path d="M18 17.500h12c1.700 0 2.500 1 2.500 2.500v1.500h-17V20c0-1.500.8-2.500 2.500-2.500z" fill="#fff" opacity=".18"/><rect x="17" y="30" width="6.500" height="13" rx="2" fill="${pants}"/><rect x="24.500" y="30" width="6.500" height="13" rx="2" fill="${pants}"/><path d="M24 31v12" stroke="${dark}" stroke-width=".6" opacity=".4"/>${shoes}`;
  }

  // Kids are drawn slightly smaller, anchored at the feet
  return isBoy || isGirl
    ? `<g transform="translate(24 44) scale(.88) translate(-24 -44)">${body}</g>`
    : body;
}
