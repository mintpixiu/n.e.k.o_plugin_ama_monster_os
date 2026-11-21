"""Original Aha-inspired artwork for the Elation material.

The window skin in this plugin is drawn from scratch: the SVG below is an
original composition of storm gradients, checker ribbon, playing cards, ribbons,
an abstract mask and warm page-like glow.  No third-party artwork or game asset
is bundled.  Users who want to use their own picture can import it through the
UI Studio's local window-image field.
"""

from __future__ import annotations

from urllib.parse import quote

_ELATION_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<defs>
<linearGradient id="storm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a0614"/><stop offset="0.45" stop-color="#170f30"/><stop offset="0.72" stop-color="#23103f"/><stop offset="1" stop-color="#08050f"/></linearGradient>
<radialGradient id="red" cx="0.18" cy="0.12" r="0.62"><stop offset="0" stop-color="#ff2f55" stop-opacity="0.5"/><stop offset="1" stop-color="#ff2f55" stop-opacity="0"/></radialGradient>
<radialGradient id="blue" cx="0.86" cy="0.16" r="0.6"><stop offset="0" stop-color="#7d8cff" stop-opacity="0.4"/><stop offset="1" stop-color="#7d8cff" stop-opacity="0"/></radialGradient>
<radialGradient id="gold" cx="0.5" cy="1.04" r="0.62"><stop offset="0" stop-color="#ffe3b0" stop-opacity="0.62"/><stop offset="1" stop-color="#ffe3b0" stop-opacity="0"/></radialGradient>
<linearGradient id="ribbon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff2f55" stop-opacity="0"/><stop offset="0.3" stop-color="#ff2f55" stop-opacity="0.75"/><stop offset="0.62" stop-color="#a01434" stop-opacity="0.6"/><stop offset="1" stop-color="#ff2f55" stop-opacity="0"/></linearGradient>
<linearGradient id="face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf6ec"/><stop offset="1" stop-color="#e7d9c4"/></linearGradient>
<linearGradient id="redface" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4a66"/><stop offset="1" stop-color="#96152d"/></linearGradient>
<pattern id="checker" width="64" height="64" patternUnits="userSpaceOnUse"><rect width="64" height="64" fill="#f7f1e6"/><rect width="32" height="32" fill="#151020"/><rect x="32" y="32" width="32" height="32" fill="#151020"/></pattern>
</defs>
<rect width="1600" height="1000" fill="url(#storm)"/>
<rect width="1600" height="1000" fill="url(#red)"/>
<rect width="1600" height="1000" fill="url(#blue)"/>
<rect width="1600" height="1000" fill="url(#gold)"/>
<g opacity="0.55">
<path d="M90 -40 L170 250 L130 262 L220 560 L180 572 L270 880" stroke="#cfe0ff" stroke-opacity="0.12" stroke-width="4" fill="none"/>
<path d="M1420 -60 L1360 220 L1400 234 L1310 520" stroke="#cfe0ff" stroke-opacity="0.09" stroke-width="3" fill="none"/>
</g>
<g transform="rotate(-16 1500 0)"><rect x="980" y="-220" width="980" height="190" fill="url(#checker)" opacity="0.36"/></g>
<g transform="rotate(12 -160 980)"><rect x="-260" y="820" width="720" height="140" fill="url(#checker)" opacity="0.24"/></g>
<path d="M-120 760 C 260 600 620 810 980 600 S 1560 640 1740 440" stroke="url(#ribbon)" stroke-width="46" fill="none" stroke-linecap="round" opacity="0.8"/>
<path d="M-120 690 C 300 560 700 760 1080 540 S 1600 560 1760 380" stroke="url(#ribbon)" stroke-width="16" fill="none" stroke-linecap="round" opacity="0.5"/>
<path d="M-80 880 C 320 760 640 930 1000 740 S 1540 780 1720 620" stroke="url(#ribbon)" stroke-width="26" fill="none" stroke-linecap="round" opacity="0.45"/>
<g opacity="0.3" transform="translate(720 120)">
<path d="M0 90 Q 90 10 190 90 Q 290 10 380 90 Q 300 220 190 190 Q 80 220 0 90 Z" fill="#0d0918" stroke="#ff2f55" stroke-opacity="0.5" stroke-width="3"/>
<path d="M-40 70 L40 -10 L80 70 Z" fill="#151020" stroke="#ff2f55" stroke-opacity="0.35" stroke-width="2"/>
<path d="M420 70 L340 -10 L300 70 Z" fill="#151020" stroke="#ff2f55" stroke-opacity="0.35" stroke-width="2"/>
<ellipse cx="105" cy="105" rx="26" ry="14" fill="#ff3b5c" opacity="0.9"/>
<ellipse cx="275" cy="105" rx="26" ry="14" fill="#ff3b5c" opacity="0.9"/>
</g>
<g>
<path d="M430 1000 C 520 900 690 878 800 930 C 910 878 1080 900 1170 1000 Z" fill="#efe2cf" opacity="0.2"/>
<path d="M470 1000 C 560 930 700 912 800 950 C 900 912 1040 930 1130 1000 Z" fill="#fff4de" opacity="0.16"/>
</g>
<g transform="translate(1150 560) rotate(14)">
<rect width="180" height="255" rx="18" fill="url(#face)" stroke="#f3e8d7" stroke-width="4" opacity="0.92"/>
<rect x="12" y="12" width="156" height="231" rx="12" fill="none" stroke="#c9b79c" stroke-width="2" opacity="0.78"/>
<text x="28" y="82" font-family="Georgia, serif" font-size="58" fill="#d21f3c">&#9829;</text>
<text x="92" y="196" font-family="Georgia, serif" font-size="52" fill="#d21f3c" opacity="0.8">&#9829;</text>
</g>
<g transform="translate(1060 600) rotate(-8)">
<rect width="170" height="240" rx="16" fill="url(#face)" stroke="#f3e8d7" stroke-width="3" opacity="0.84"/>
<text x="24" y="76" font-family="Georgia, serif" font-size="52" fill="#151020">&#9824;</text>
<text x="82" y="184" font-family="Georgia, serif" font-size="48" fill="#151020" opacity="0.8">&#9824;</text>
</g>
<g transform="translate(1258 610) rotate(24)">
<rect width="160" height="228" rx="16" fill="url(#redface)" stroke="#ff8ba0" stroke-width="3" opacity="0.8"/>
<text x="22" y="74" font-family="Georgia, serif" font-size="50" fill="#fff1e6">&#9830;</text>
<text x="78" y="176" font-family="Georgia, serif" font-size="46" fill="#fff1e6" opacity="0.85">&#9830;</text>
</g>
<g transform="translate(190 210) rotate(-12)">
<rect width="130" height="184" rx="14" fill="url(#face)" stroke="#f3e8d7" stroke-width="3" opacity="0.66"/>
<text x="20" y="62" font-family="Georgia, serif" font-size="42" fill="#151020">&#9827;</text>
</g>
<g fill="#ffe6a8">
<path d="M260 150 l10 26 26 10 -26 10 -10 26 -10 -26 -26 -10 26 -10 z" opacity="0.8"/>
<path d="M1380 250 l8 20 20 8 -20 8 -8 20 -8 -20 -20 -8 20 -8 z" opacity="0.6"/>
<path d="M1210 830 l7 18 18 7 -18 7 -7 18 -7 -18 -18 -7 18 -7 z" opacity="0.5"/>
<circle cx="520" cy="260" r="3" opacity="0.7"/>
<circle cx="880" cy="180" r="2.5" opacity="0.6"/>
<circle cx="1420" cy="700" r="3" opacity="0.55"/>
<circle cx="330" cy="620" r="2.5" opacity="0.5"/>
</g>
</svg>"""

ELATION_MEDIA_TYPE = "data:image/svg+xml;charset=utf-8,"


def elation_art() -> str:
    """Return the inline SVG data URI used by the Elation material."""

    return ELATION_MEDIA_TYPE + quote(_ELATION_SVG, safe="")


def ui_art_payload() -> dict[str, str]:
    """Return the artwork map embedded in the shell snapshot."""

    return {"elation": elation_art()}


__all__ = ["ELATION_MEDIA_TYPE", "elation_art", "ui_art_payload"]
