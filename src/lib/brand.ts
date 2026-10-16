// The Rested mark: a crescent and a spark on an indigo field. Full-bleed so it also works as a
// maskable PWA icon and as the iOS home-screen icon (iOS rounds the corners itself).
export const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#7472F5"/><stop offset="1" stop-color="#3A2EA6"/></linearGradient></defs>
<rect width="1024" height="1024" fill="url(#g)"/>
<path transform="translate(150 160) scale(23)" d="M24.5 18.6A10.5 10.5 0 0 1 11.4 5.5a10.5 10.5 0 1 0 13.1 13.1Z" fill="#fff"/>
<path transform="translate(700 250)" d="M0-78C8-26 26-8 78 0 26 8 8 26 0 78-8 26-26 8-78 0-26-8-8-26 0-78Z" fill="#fff" opacity=".9"/>
</svg>`;

export const MARK_DATA_URI = `data:image/svg+xml;utf8,${encodeURIComponent(MARK_SVG)}`;
