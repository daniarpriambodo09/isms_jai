// lib/config.ts

// The app is served behind a reverse-proxy sub-path in production.
// next/link, next/image, and router.push() pick this up automatically
// when `basePath` is set in next.config.js — but a plain fetch('/api/...')
// from a client component does NOT, so every manual fetch to our own
// API routes must be prefixed with this constant.
export const API_BASE_PATH = '/isms-jai'

// Every date the server formats (emails, PDFs) is shown in WIB, whatever
// timezone the host machine runs in — otherwise a UTC server prints an
// approval made at 00:00–06:59 WIB on the previous day.
export const APP_TIME_ZONE = 'Asia/Jakarta'
