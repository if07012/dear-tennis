# Dear Tennis - Product Requirements Document (PRD)

> Version 1.0

## Overview

Dear Tennis adalah website komunitas tenis modern yang dibangun
menggunakan **Next.js 15**, **Tailwind CSS**, **GSAP**, **Framer
Motion**, dan **Lenis** untuk menghadirkan pengalaman scrolling premium
dengan efek parallax yang halus.

## Technology

-   Next.js 15 (App Router)
-   React 19
-   TypeScript
-   Tailwind CSS
-   GSAP + ScrollTrigger
-   Framer Motion
-   Lenis Smooth Scroll
-   Vercel

## Design System

### Philosophy

Modern, Premium, Elegant, Apple-inspired.

### Color Palette

#### Hunter Green (Primary)

``` css
--color-hunter-green-50: #f0f4f1;
--color-hunter-green-100: #e1eae3;
--color-hunter-green-200: #c4d4c6;
--color-hunter-green-300: #a6bfaa;
--color-hunter-green-400: #89a98d;
--color-hunter-green-500: #6b9471;
--color-hunter-green-600: #56765a;
--color-hunter-green-700: #405944;
--color-hunter-green-800: #2b3b2d;
--color-hunter-green-900: #151e17;
--color-hunter-green-950: #0f1510;
```

#### Reddish Brown

``` css
--color-reddish-brown-50: #f9eeec;
--color-reddish-brown-100: #f2ddd9;
--color-reddish-brown-200: #e6bcb3;
--color-reddish-brown-300: #d99a8c;
--color-reddish-brown-400: #cc7966;
--color-reddish-brown-500: #bf5740;
--color-reddish-brown-600: #994633;
--color-reddish-brown-700: #733426;
--color-reddish-brown-800: #4d2319;
--color-reddish-brown-900: #26110d;
--color-reddish-brown-950: #1b0c09;
```

#### Spicy Paprika

``` css
--color-spicy-paprika-50: #faefea;
--color-spicy-paprika-100: #f6ded5;
--color-spicy-paprika-200: #edbeab;
--color-spicy-paprika-300: #e39d82;
--color-spicy-paprika-400: #da7d58;
--color-spicy-paprika-500: #d15c2e;
--color-spicy-paprika-600: #a74a25;
--color-spicy-paprika-700: #7d371c;
--color-spicy-paprika-800: #542512;
--color-spicy-paprika-900: #2a1209;
--color-spicy-paprika-950: #1d0d06;
```

#### Graphite

``` css
--color-graphite-50: #f2f3f2;
--color-graphite-100: #e4e7e4;
--color-graphite-200: #caceca;
--color-graphite-300: #afb6af;
--color-graphite-400: #959d95;
--color-graphite-500: #7a857a;
--color-graphite-600: #626a62;
--color-graphite-700: #495049;
--color-graphite-800: #313531;
--color-graphite-900: #181b18;
--color-graphite-950: #111311;
```

#### Muted Teal

``` css
--color-muted-teal-50: #eef6f4;
--color-muted-teal-100: #deede8;
--color-muted-teal-200: #bddbd1;
--color-muted-teal-300: #9cc9ba;
--color-muted-teal-400: #7ab8a3;
--color-muted-teal-500: #59a68c;
--color-muted-teal-600: #478570;
--color-muted-teal-700: #366354;
--color-muted-teal-800: #244238;
--color-muted-teal-900: #12211c;
--color-muted-teal-950: #0c1714;
```

## Website Flow

Hero → About → Why Join Us → Activities → Events → Gallery →
Testimonials → Statistics → FAQ → CTA → Footer

## Hero

-   Fullscreen
-   Video Background
-   GSAP Parallax
-   Lenis Smooth Scroll
-   Character Reveal
-   Mouse Interaction
-   Apple-like transition

## Main Sections

-   About Dear Tennis
-   Why Join Us
-   Activities Timeline
-   Upcoming Events
-   Gallery Masonry
-   Testimonials
-   Community Statistics
-   FAQ
-   Join Community CTA
-   Footer

## Performance

-   Lighthouse \>95
-   SEO \>95
-   Accessibility \>95

## Folder Structure

``` text
/app
/components
/lib
/public
/styles
/types
```

## Future Roadmap

-   Member Dashboard
-   Booking Court
-   Tournament Registration
-   Blog CMS
-   Merchandise
-   Leaderboard
-   WhatsApp Integration
-   Google Calendar Sync
