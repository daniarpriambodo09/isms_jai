// components/documents/PDFViewer.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface PDFViewerProps {
  filePath: string;
  fileName: string;
}

/**
 * PDFViewer berbasis Blob URL
 * 
 * KENAPA BLOB, BUKAN IFRAME LANGSUNG?
 * - <iframe src="/uploads/file.pdf"> → Browser/IDM mendeteksi URL file PDF → auto-download
 * - <iframe src="blob:..."> → Tidak ada URL yang bisa diintersep IDM → PDF tampil inline
 * - Juga berfungsi di halaman tanpa auth cookie (misal /review-page-owner)
 *   karena fetch dilakukan oleh Next.js API route (/api/files/serve) di server side
 */
export default function PDFViewer({ filePath, fileName }: PDFViewerProps) {
  const [blobUrl, setBlobUrl]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(false);
  const blobRef                 = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadBlob = async () => {
      try {
        setLoading(true);
        setError(false);

        // Strip leading slash jika ada, karena API serve menambahkan prefix sendiri
        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
        const encodedPath = encodeURIComponent(cleanPath);

        const res = await fetch(`/isms-jai/api/files/serve?path=${encodedPath}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        if (cancelled) return;

        // Pastikan type adalah PDF agar browser merender inline, bukan download
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const url = URL.createObjectURL(pdfBlob);

        blobRef.current = url;
        setBlobUrl(url);
      } catch (err) {
        console.error('PDFViewer: gagal memuat blob', err);
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBlob();

    // Cleanup: revoke blob URL saat komponen unmount untuk mencegah memory leak
    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [filePath]);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-3 py-16 bg-slate-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p className="text-slate-500 text-sm">Memuat dokumen PDF...</p>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="w-full flex flex-col items-center justify-center gap-4 py-16 bg-slate-50">
        <div className="w-16 h-16 rounded-full bg-slate-200 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-slate-700 font-medium mb-1">Gagal memuat PDF</p>
          <p className="text-slate-500 text-sm">File tidak dapat ditampilkan di browser</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full" style={{ minHeight: '600px' }}>
      {/*
        Gunakan <object> bukan <iframe>:
        - Lebih stabil untuk PDF di berbagai browser
        - IDM tidak bisa mengintersep blob: URL
      */}
      <object
        data={blobUrl}
        type="application/pdf"
        className="w-full h-full border-0"
        style={{ minHeight: '600px', display: 'block' }}
      >
        {/* Fallback jika browser tidak support <object> untuk PDF */}
        <div className="w-full flex flex-col items-center justify-center gap-3 py-16">
          <p className="text-slate-600 text-sm">Browser Anda tidak mendukung tampilan PDF inline.</p>
          <a
            href={blobUrl}
            download={fileName}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Download PDF
          </a>
        </div>
      </object>
    </div>
  );
}