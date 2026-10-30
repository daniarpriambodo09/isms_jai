'use client'

import React, { useState, useEffect } from 'react'
import QRCode from 'qrcode'
import {
  Wifi,
  Server,
  KeyRound,
  Copy,
  Check,
  Printer,
  Send,
  Eye,
  EyeOff,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  User,
  Building,
  QrCode,
  ExternalLink,
  X,
} from 'lucide-react'
import { API_BASE_PATH } from '@/lib/config'
import { copyText } from '@/lib/clipboard'

export interface NetworkPassData {
  title?: string
  recipientName: string
  companyOrDept?: string | null
  requestNoOrCode: string
  ssid?: string | null
  networkUsername?: string | null
  networkPassword?: string | null
  ipMode?: 'dhcp' | 'static' | string
  assignedIp: string
  subnetMask?: string | null
  gateway?: string | null
  dnsPrimary?: string | null
  dnsSecondary?: string | null
  validFrom?: string | null
  validUntil?: string | null
  approvedBy?: string | null
  approvedAt?: string | null
  directLink?: string | null
}

export function buildNetworkWhatsAppText(data: NetworkPassData): string {
  const lines: string[] = [
    `*PT. JATIM AUTOCOMP INDONESIA - IT DIVISION*`,
    `*SLIP PARAMETER KONEKSI JARINGAN & INTERNET*`,
    `=========================================`,
    `Yth. *${data.recipientName}*${data.companyOrDept ? ` (${data.companyOrDept})` : ''},`,
    `Izin akses jaringan Anda telah *DISETUJUI* oleh Tim IT PT. JAI.`,
    ``,
    `Berikut parameter resmi untuk terhubung ke jaringan:`,
    ``,
    `📶 *KONEKSI WI-FI & LOGIN:*`,
    `• SSID Wi-Fi : *${data.ssid || 'JAI-CORP-GUEST'}*`,
  ]

  if (data.networkUsername) {
    lines.push(`• Username   : *${data.networkUsername}*`)
  }
  if (data.networkPassword) {
    lines.push(`• Password   : *${data.networkPassword}*`)
  }

  lines.push(
    ``,
    `🌐 *KONFIGURASI TCP/IPv4:*`,
    `• Mode       : *${data.ipMode === 'static' ? 'Static IP' : 'DHCP / Reserved IP'}*`,
    `• IP Address : *${data.assignedIp || '-'}*`,
    `• Subnet Mask: *${data.subnetMask || '255.255.255.0'}*`,
    `• Gateway    : *${data.gateway || '192.168.50.1'}*`,
    `• DNS 1      : *${data.dnsPrimary || '192.168.1.10'}*`,
    `• DNS 2      : *${data.dnsSecondary || '8.8.8.8'}*`,
    ``,
    `📅 *Masa Berlaku :* ${data.validFrom || '-'} s/d ${data.validUntil || '-'}`,
    `🔖 *No. Registrasi:* ${data.requestNoOrCode}`,
    ``,
    `⚠️ *Ketentuan ISMS ISO 27001 PT. JAI:*`,
    `1. Perangkat telah diperiksa dan bebas virus/malware.`,
    `2. Dilarang mengubah konfigurasi IP atau menyebarkan kredensial.`,
    `3. Semua aktivitas jaringan dicatat dan diaudit demi keamanan.`
  )

  if (data.directLink) {
    lines.push(
      ``,
      `🔗 *Buka Kartu Akses Digital:*`,
      data.directLink
    )
  }

  lines.push(`=========================================`)
  return lines.join('\n')
}

interface NetworkPassCardProps {
  data: NetworkPassData
  showPrintButton?: boolean
  showWhatsAppButton?: boolean
  className?: string
}

export function NetworkPassCard({
  data,
  showPrintButton = true,
  showWhatsAppButton = true,
  className = '',
}: NetworkPassCardProps) {
  const [showPassword, setShowPassword] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [wifiQrUrl, setWifiQrUrl] = useState<string>('')

  useEffect(() => {
    const ssid = data.ssid || 'JAI-CORP-GUEST'
    const password = data.networkPassword || ''
    const escapeWifi = (s: string) => s.replace(/([\\;,":])/g, '\\$1')
    const payload = password
      ? `WIFI:S:${escapeWifi(ssid)};T:WPA;P:${escapeWifi(password)};;`
      : `WIFI:S:${escapeWifi(ssid)};T:nopass;;`

    QRCode.toDataURL(payload, {
      margin: 1,
      width: 240,
      color: {
        dark: '#064e3b',
        light: '#ffffff',
      },
    })
      .then((url) => setWifiQrUrl(url))
      .catch((err) => console.error('Failed to generate Wi-Fi QR:', err))
  }, [data.ssid, data.networkPassword])

  const handleCopy = async (field: string, text: string) => {
    const ok = await copyText(text)
    if (ok) {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleShareWhatsApp = () => {
    const text = buildNetworkWhatsAppText(data)
    const encoded = encodeURIComponent(text)
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank')
  }

  const handlePrintSlip = () => {
    const printWindow = window.open('', '_blank', 'width=800,height=750')
    if (!printWindow) {
      window.print()
      return
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Slip Akses Jaringan - ${data.recipientName} - PT. JAI</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
            body { margin: 0; padding: 24px; background: #f8fafc; display: flex; justify-content: center; }
            .slip-card {
              width: 100%;
              max-width: 640px;
              background: #ffffff;
              border: 2px solid #0f766e;
              border-radius: 16px;
              overflow: hidden;
              box-shadow: 0 4px 12px rgba(0,0,0,0.08);
            }
            .slip-header {
              background: #0f766e;
              color: #ffffff;
              padding: 16px 20px;
              display: flex;
              align-items: center;
              justify-content: space-between;
            }
            .slip-body { padding: 20px; }
            .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
            .box {
              background: #f1f5f9;
              border: 1px solid #cbd5e1;
              border-radius: 8px;
              padding: 10px 14px;
            }
            .box-highlight {
              background: #ecfdf5;
              border: 1.5px solid #10b981;
              border-radius: 8px;
              padding: 12px 14px;
            }
            .label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 600; margin-bottom: 2px; }
            .value { font-size: 13px; font-weight: bold; color: #0f172a; word-break: break-all; }
            .ip-value { font-size: 20px; font-weight: 800; color: #047857; font-family: monospace; }
            .mono { font-family: monospace; }
            .footer-notes {
              margin-top: 16px;
              padding: 12px;
              background: #fffbeb;
              border: 1px solid #fef3c7;
              border-radius: 8px;
              font-size: 11px;
              color: #92400e;
              line-height: 1.5;
            }
            @media print {
              body { background: #ffffff; padding: 0; }
              .slip-card { box-shadow: none; max-width: 100%; border: 1.5px solid #000; }
              .slip-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="slip-card">
            <div class="slip-header">
              <div>
                <div style="font-size: 16px; font-weight: 800; letter-spacing: 0.5px;">PT. JATIM AUTOCOMP INDONESIA</div>
                <div style="font-size: 11px; opacity: 0.9;">IT DIVISION · ISMS ISO 27001 AUTHORIZED ACCESS</div>
              </div>
              <div style="text-align: right; font-size: 10px; font-weight: 700; background: rgba(255,255,255,0.2); padding: 4px 8px; border-radius: 4px;">
                OFFICIAL NETWORK SLIP
              </div>
            </div>
            <div class="slip-body">
              <div class="grid-2" style="margin-bottom: 12px;">
                <div class="box">
                  <div class="label">Nama Pengguna / Tamu</div>
                  <div class="value">${data.recipientName}</div>
                </div>
                <div class="box">
                  <div class="label">Instansi / Departemen</div>
                  <div class="value">${data.companyOrDept || '-'}</div>
                </div>
              </div>

              ${
                wifiQrUrl
                  ? `
              <div style="margin-bottom: 12px; display: flex; align-items: center; gap: 16px; background: #ecfdf5; border: 1.5px solid #10b981; border-radius: 10px; padding: 12px;">
                <div style="background: #ffffff; padding: 4px; border-radius: 8px; border: 1px solid #a7f3d0; text-align: center; flex-shrink: 0;">
                  <img src="${wifiQrUrl}" width="100" height="100" style="display: block;" alt="Wi-Fi QR Code" />
                  <div style="font-size: 8px; font-weight: 800; color: #047857; margin-top: 3px; letter-spacing: 0.5px;">SCAN WI-FI CEPAT</div>
                </div>
                <div style="flex: 1;">
                  <div style="font-size: 11px; font-weight: 800; color: #047857; text-transform: uppercase;">
                    Akses Wi-Fi Cepat via Kamera HP / Tablet
                  </div>
                  <div style="font-size: 11px; color: #065f46; margin-top: 3px; line-height: 1.4;">
                    Pindai QR Code di samping menggunakan kamera smartphone (iOS / Android) untuk langsung terhubung otomatis ke jaringan Wi-Fi <strong>${data.ssid || 'JAI-CORP-GUEST'}</strong>.
                  </div>
                  <div style="margin-top: 6px; font-size: 11px; color: #1e293b; background: #ffffff; padding: 4px 8px; border-radius: 6px; border: 1px solid #cbd5e1; display: inline-block;">
                    SSID: <strong>${data.ssid || 'JAI-CORP-GUEST'}</strong> ${data.networkPassword ? `&bull; Password: <strong>${data.networkPassword}</strong>` : ''}
                  </div>
                </div>
              </div>
              `
                  : ''
              }

              <div class="box-highlight" style="margin-bottom: 12px; text-align: center;">
                <div class="label" style="color: #047857;">Alokasi IP Address Resmi (IPv4)</div>
                <div class="ip-value">${data.assignedIp || 'MENUNGGU ASSIGN'}</div>
                <div style="font-size: 11px; color: #065f46; margin-top: 4px;">
                  Mode: <strong>${data.ipMode === 'static' ? 'Static IP' : 'DHCP / Reserved IP'}</strong> · Wi-Fi SSID: <strong>${data.ssid || 'JAI-CORP-GUEST'}</strong>
                </div>
              </div>

              <div class="grid-2" style="margin-bottom: 12px;">
                <div class="box">
                  <div class="label">Subnet Mask</div>
                  <div class="value mono">${data.subnetMask || '255.255.255.0'}</div>
                </div>
                <div class="box">
                  <div class="label">Default Gateway</div>
                  <div class="value mono">${data.gateway || '192.168.50.1'}</div>
                </div>
              </div>

              <div class="grid-2" style="margin-bottom: 12px;">
                <div class="box">
                  <div class="label">Preferred DNS</div>
                  <div class="value mono">${data.dnsPrimary || '192.168.1.10'}</div>
                </div>
                <div class="box">
                  <div class="label">Alternate DNS</div>
                  <div class="value mono">${data.dnsSecondary || '8.8.8.8'}</div>
                </div>
              </div>

              ${
                data.networkUsername || data.networkPassword
                  ? `
                <div class="grid-2" style="margin-bottom: 12px;">
                  <div class="box">
                    <div class="label">Username Login (Portal)</div>
                    <div class="value mono">${data.networkUsername || '-'}</div>
                  </div>
                  <div class="box">
                    <div class="label">Password Login</div>
                    <div class="value mono">${data.networkPassword || '-'}</div>
                  </div>
                </div>
              `
                  : ''
              }

              <div class="grid-2">
                <div class="box">
                  <div class="label">Masa Berlaku Izin</div>
                  <div class="value" style="font-size: 12px;">${data.validFrom || '-'} s/d ${data.validUntil || '-'}</div>
                </div>
                <div class="box">
                  <div class="label">No. Registrasi / Status</div>
                  <div class="value" style="font-size: 12px; color: #047857;">${data.requestNoOrCode} · VERIFIED IT</div>
                </div>
              </div>

              <div class="footer-notes">
                <strong>Ketentuan Keamanan ISMS PT. JAI:</strong><br />
                Perangkat telah diverifikasi bebas malware. Dilarang mengubah konfigurasi IP atau menyebarkan kredensial kepada pihak tidak berkepentingan. Seluruh trafik dipantau dan diaudit.
              </div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `
    printWindow.document.open()
    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border-2 border-emerald-600/30 bg-gradient-to-b from-card via-card to-emerald-50/20 shadow-md ${className}`}
    >
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 px-5 py-4 text-white">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-8 items-center overflow-hidden rounded-full bg-white px-2.5 shadow-xs">
              <img
                src={`${API_BASE_PATH}/images/yazaki-logo.jpg`}
                alt="Yazaki PT. JAI"
                className="h-4 w-auto object-contain"
              />
            </span>
            <div>
              <div className="font-bold text-sm tracking-wide">
                PT. JATIM AUTOCOMP INDONESIA
              </div>
              <div className="text-[11px] text-emerald-200/90 font-medium">
                IT DIVISION · KARTU RESMI PARAMETER JARINGAN &amp; INTERNET
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-200 border border-emerald-400/30">
              <ShieldCheck className="size-3 text-emerald-300" /> OFFICIAL PASS
            </span>
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-6 space-y-5">
        {/* User and Ticket Meta */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
            <User className="size-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Nama Penerima Akses
              </span>
              <span className="font-bold text-foreground text-sm">
                {data.recipientName}
              </span>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/40 border border-border">
            <Building className="size-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Instansi / Departemen
              </span>
              <span className="font-semibold text-foreground">
                {data.companyOrDept || '-'}
              </span>
            </div>
          </div>
        </div>

        {/* QR CODE WI-FI SCANNER SECTION */}
        {wifiQrUrl && (
          <div className="rounded-2xl border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-card to-teal-500/10 p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 shadow-xs">
            <div className="shrink-0 flex flex-col items-center">
              <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-emerald-300">
                <img
                  src={wifiQrUrl}
                  alt={`QR Code Wi-Fi ${data.ssid || 'JAI-CORP-GUEST'}`}
                  className="size-32 sm:size-36 object-contain rounded-lg"
                />
              </div>
              <span className="text-[10px] font-extrabold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                <QrCode className="size-3" /> Scan Kamera HP
              </span>
            </div>

            <div className="flex-1 space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600/15 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
                <Wifi className="size-3.5 text-emerald-700 dark:text-emerald-400" /> Konek Cepat Wi-Fi Tamu
              </div>
              <h3 className="text-sm font-bold text-foreground">
                Pindai QR Code untuk Terhubung Otomatis
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Arahkan kamera smartphone (iPhone/Android) ke kode QR untuk langsung tersambung ke Wi-Fi{' '}
                <strong className="text-foreground">{data.ssid || 'JAI-CORP-GUEST'}</strong> tanpa perlu mengetik kata sandi secara manual.
              </p>
              <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border font-mono font-semibold text-foreground">
                  <span>SSID: {data.ssid || 'JAI-CORP-GUEST'}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy('ssid', data.ssid || 'JAI-CORP-GUEST')}
                    className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Salin SSID"
                  >
                    {copiedField === 'ssid' ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
                {data.networkPassword && (
                  <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-card border border-border font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    <span>Pass: {showPassword ? data.networkPassword : '••••••••••••'}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('qr_pass', data.networkPassword || '')}
                      className="p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Salin Password"
                    >
                      {copiedField === 'qr_pass' ? (
                        <Check className="size-3 text-emerald-600" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SECTION DIVIDER: PENGATURAN MANUAL */}
        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-2 bg-card rounded-md border border-border/60 py-0.5">
            Atau Hubungkan Manual (Laptop / PC / Konfigurasi IP)
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* PROMINENT IP ADDRESS CARD */}
        <div className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-5 text-center relative overflow-hidden">
          <span className="absolute -top-10 -right-10 size-28 rounded-full bg-emerald-500/10 blur-xl" />
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider mb-1">
            <Server className="size-4" /> Alokasi IP Address Resmi
          </div>
          <div className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight my-1">
            {data.assignedIp || 'MENUNGGU ALOKASI IT'}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-emerald-900 dark:text-emerald-200 mt-2 font-medium">
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[11px] font-semibold">
              Mode: {data.ipMode === 'static' ? 'Static IP' : 'DHCP / Reserved IP'}
            </span>
            <span>&bull;</span>
            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-[11px] font-semibold">
              SSID: {data.ssid || 'JAI-CORP-GUEST'}
            </span>
            <button
              type="button"
              onClick={() => handleCopy('ip', data.assignedIp)}
              className="inline-flex items-center gap-1 ml-1 px-2.5 py-0.5 rounded-md bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition shadow-xs"
            >
              {copiedField === 'ip' ? (
                <>
                  <Check className="size-3" /> Tersalin!
                </>
              ) : (
                <>
                  <Copy className="size-3" /> Salin IP
                </>
              )}
            </button>
          </div>
        </div>

        {/* TCP/IP Parameter Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          <div className="p-3 rounded-xl bg-card border border-border">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Subnet Mask
            </p>
            <p className="font-mono font-bold text-foreground mt-0.5">
              {data.subnetMask || '255.255.255.0'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Gateway
            </p>
            <p className="font-mono font-bold text-foreground mt-0.5">
              {data.gateway || '192.168.50.1'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              DNS Primary
            </p>
            <p className="font-mono font-bold text-foreground mt-0.5">
              {data.dnsPrimary || '192.168.1.10'}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              DNS Secondary
            </p>
            <p className="font-mono font-bold text-foreground mt-0.5">
              {data.dnsSecondary || '8.8.8.8'}
            </p>
          </div>
        </div>

        {/* Captive Portal / 802.1X Login Credentials (If Available) */}
        {(data.networkUsername || data.networkPassword) && (
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-foreground">
              <KeyRound className="size-4 text-emerald-700" /> Kredensial Login
              Jaringan (Captive Portal)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                    Username
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {data.networkUsername || '-'}
                  </span>
                </div>
                {data.networkUsername && (
                  <button
                    type="button"
                    onClick={() => handleCopy('user', data.networkUsername || '')}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    title="Salin Username"
                  >
                    {copiedField === 'user' ? (
                      <Check className="size-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border">
                <div>
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground block">
                    Password
                  </span>
                  <span className="font-mono font-bold text-foreground">
                    {showPassword ? data.networkPassword || '-' : '••••••••••••'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                    title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </button>
                  {data.networkPassword && (
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy('pass', data.networkPassword || '')
                      }
                      className="p-1 rounded hover:bg-muted text-muted-foreground"
                      title="Salin Password"
                    >
                      {copiedField === 'pass' ? (
                        <Check className="size-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Validity & Verification Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-dashed border-border">
          <div className="flex items-center gap-1.5">
            <Calendar className="size-3.5 text-emerald-600" />
            <span>
              Masa Berlaku: <strong>{data.validFrom || '-'}</strong> s/d{' '}
              <strong>{data.validUntil || '-'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5 text-emerald-600" />
            <span>Disetujui oleh: {data.approvedBy || 'System Security Admin (IT)'}</span>
          </div>
        </div>

        {/* ACTION BUTTONS: WhatsApp, Print, Copy */}
        <div className="pt-2 flex flex-wrap gap-2.5">
          {showWhatsAppButton && (
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white font-bold text-xs transition shadow-sm"
            >
              <Send className="size-4" /> Kirim via WhatsApp
            </button>
          )}

          <button
            type="button"
            onClick={() => handleCopy('wa', buildNetworkWhatsAppText(data))}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-semibold text-xs transition border border-border"
          >
            {copiedField === 'wa' ? (
              <>
                <Check className="size-4 text-emerald-600" /> Format WA Tersalin!
              </>
            ) : (
              <>
                <Copy className="size-4" /> Salin Format WA
              </>
            )}
          </button>

          {showPrintButton && (
            <button
              type="button"
              onClick={handlePrintSlip}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition shadow-sm"
            >
              <Printer className="size-4" /> Cetak / Unduh Slip Gambar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface NetworkPassModalProps {
  open: boolean
  onClose: () => void
  data: NetworkPassData | null
}

export function NetworkPassModal({ open, onClose, data }: NetworkPassModalProps) {
  if (!open || !data) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-card rounded-2xl shadow-2xl border border-border">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 size-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition"
          aria-label="Tutup"
        >
          <X className="size-4" />
        </button>
        <NetworkPassCard data={data} />
      </div>
    </div>
  )
}

