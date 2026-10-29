// app/api/it-guest-links/[id]/route.ts
import { NextResponse, type NextRequest } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth'
import {
  getItGuestAccessLinkById,
  getItGuestAccessLinkByCodeOrToken,
  submitItGuestForm1,
  submitItGuestForm2Network,
  submitItGuestCombinedForms,
  approveOrRejectItGuestLink,
  deleteItGuestAccessLink,
} from '@/lib/it-guest-link-service'

async function resolveLink(idOrCode: string) {
  const num = Number(idOrCode)
  if (!isNaN(num) && num > 0) {
    const byId = await getItGuestAccessLinkById(num)
    if (byId) return byId
  }
  return getItGuestAccessLinkByCodeOrToken(idOrCode)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const link = await resolveLink(id)
    if (!link) {
      return NextResponse.json({ error: 'Link tamu tidak ditemukan' }, { status: 404 })
    }
    return NextResponse.json({ link })
  } catch (error: any) {
    console.error('[api/it-guest-links/[id]] GET error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memuat detail link tamu' },
      { status: 500 }
    )
  }
}

/**
 * POST: Tamu mengirim 2 Form sekaligus (Form Izin Masuk Alat IT + Form Network Internal)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await resolveLink(id)
    if (!existing) {
      return NextResponse.json({ error: 'Link akses tamu tidak ditemukan' }, { status: 404 })
    }

    const body = await request.json()
    const {
      step = 'combined', // 'form_1' | 'form_2' | 'combined'
      form_type = 'in', // 'in' (ISMS-F-03-00-001) | 'out' (ISMS-F-03-00-002)
      guest_name,
      applicant_nik = '',
      company_name,
      department,
      section,
      location,
      purpose,
      date_in,
      date_out_plan,
      applicant_phone = '',
      applicant_email = '',
      items = [],
      connection_type = 'Wi-Fi Internal (Wireless)',
      device_type = 'Notebook / Laptop',
      mac_address = '',
      os_info = '',
      antivirus_installed = 'Ya',
      antivirus_name = '',
      antivirus_version = 'Terbaru (Up-to-date)',
      antivirus_updated = 'Ya',
      network_purpose = '',
      purpose_internet = true,
      purpose_email = true,
      purpose_web = false,
      purpose_ftp = false,
      purpose_others = '',
    } = body

    // =========================================================================
    // TAHAP 1 SAJA: Pengajuan Form 1 (Izin Membawa Masuk 001 / Membawa Keluar 002)
    // =========================================================================
    if (step === 'form_1') {
      const finalGuestName = (guest_name || existing.guest_name || '').trim()
      const finalCompany = (company_name || existing.company_name || '').trim()
      const finalDepartment = (department || existing.department || '').trim()

      if (
        !finalGuestName ||
        !finalCompany ||
        !finalDepartment ||
        !section?.trim() ||
        !location?.trim() ||
        !purpose?.trim() ||
        !date_in ||
        !date_out_plan
      ) {
        return NextResponse.json(
          { error: 'Mohon lengkapi seluruh kolom identitas, jadwal, dan tujuan pada Form 1 (Izin Alat IT).' },
          { status: 400 }
        )
      }

      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { error: 'Mohon tambahkan minimal 1 perangkat IT yang dibawa pada Form 1.' },
          { status: 400 }
        )
      }

      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (!it.brand?.trim() || !it.serial_no?.trim() || !it.id_no?.trim()) {
          return NextResponse.json(
            { error: `Alat #${i + 1}: Merk/Produsen, Serial Number, dan No. Identifikasi Alat wajib diisi.` },
            { status: 400 }
          )
        }
      }

      const updatedLink = await submitItGuestForm1(existing.id, {
        form_type: form_type === 'out' ? 'out' : 'in',
        guest_name: finalGuestName,
        applicant_nik: applicant_nik?.trim() || '',
        company_name: finalCompany,
        department: finalDepartment,
        section: section.trim(),
        location: location.trim(),
        purpose: purpose.trim(),
        date_in,
        date_out_plan,
        applicant_phone,
        applicant_email,
        items,
      })

      return NextResponse.json({
        success: true,
        message:
          'Formulir 1 (Izin Membawa Masuk/Keluar Alat IT) berhasil dikirim! Menunggu persetujuan Tahap 1 dari Admin IT sebelum Anda dapat melanjutkan ke Formulir 2 (Penyambungan Jaringan).',
        link: updatedLink,
      })
    }

    // =========================================================================
    // TAHAP 2 SAJA: Pengajuan Form 2 (Penyambungan Jaringan Internal ISMS-F-03-00-003)
    // WAJIB: Form 1 harus sudah berstatus 'approved'!
    // =========================================================================
    if (step === 'form_2') {
      if (!existing.equipment_request || existing.equipment_request.status !== 'approved') {
        return NextResponse.json(
          {
            error:
              'Alur Bertahap: Formulir 1 (Izin Alat IT) belum di-Approve oleh Admin IT. Anda belum dapat mengajukan Formulir 2 (Penyambungan Jaringan).',
          },
          { status: 400 }
        )
      }

      if (!mac_address?.trim() || !os_info?.trim() || !antivirus_name?.trim()) {
        return NextResponse.json(
          {
            error:
              'Mohon lengkapi MAC Address, Sistem Operasi (OS), dan Nama Antivirus pada Form 2 (Penyambungan Jaringan Internal).',
          },
          { status: 400 }
        )
      }

      const updatedLink = await submitItGuestForm2Network(existing.id, {
        connection_type,
        device_type,
        mac_address,
        os_info,
        antivirus_installed,
        antivirus_name,
        antivirus_version,
        antivirus_updated,
        network_purpose,
        purpose_internet: Boolean(purpose_internet),
        purpose_email: Boolean(purpose_email),
        purpose_web: Boolean(purpose_web),
        purpose_ftp: Boolean(purpose_ftp),
        purpose_others: String(purpose_others ?? ''),
      })

      return NextResponse.json({
        success: true,
        message:
          'Formulir 2 (Penyambungan Jaringan Internal ISMS-F-03-00-003) berhasil dikirim! Menunggu pemeriksaan IT Section Check & alokasi Username/IP.',
        link: updatedLink,
      })
    }

    const finalGuestName = (guest_name || existing.guest_name || '').trim()
    const finalCompany = (company_name || existing.company_name || '').trim()
    const finalDepartment = (department || existing.department || '').trim()

    if (!finalGuestName || !finalCompany || !finalDepartment || !section?.trim() || !location?.trim() || !purpose?.trim() || !date_in || !date_out_plan) {
      return NextResponse.json(
        { error: 'Mohon lengkapi seluruh kolom identitas, jadwal, dan tujuan pada Form 1 (Izin Masuk Alat IT).' },
        { status: 400 }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'Mohon tambahkan minimal 1 perangkat IT yang dibawa pada Form 1.' },
        { status: 400 }
      )
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.brand?.trim() || !it.serial_no?.trim() || !it.id_no?.trim()) {
        return NextResponse.json(
          { error: `Alat #${i + 1}: Merk/Produsen, Serial Number, dan No. Identifikasi Alat wajib diisi.` },
          { status: 400 }
        )
      }
    }

    if (!mac_address?.trim() || !os_info?.trim() || !antivirus_name?.trim()) {
      return NextResponse.json(
        { error: 'Mohon lengkapi MAC Address, Sistem Operasi (OS), dan Nama Antivirus pada Form 2 (Penyambungan Jaringan Internal).' },
        { status: 400 }
      )
    }

    const updatedLink = await submitItGuestCombinedForms(existing.id, {
      guest_name: finalGuestName,
      company_name: finalCompany,
      department: finalDepartment,
      section: section.trim(),
      location: location.trim(),
      purpose: purpose.trim(),
      date_in,
      date_out_plan,
      applicant_phone,
      applicant_email,
      items,
      connection_type,
      device_type,
      mac_address,
      os_info,
      antivirus_installed,
      antivirus_name,
      antivirus_version,
      antivirus_updated,
      network_purpose: network_purpose || purpose,
      purpose_internet: Boolean(purpose_internet),
      purpose_email: Boolean(purpose_email),
      purpose_web: Boolean(purpose_web),
      purpose_ftp: Boolean(purpose_ftp),
      purpose_others: String(purpose_others ?? ''),
    })

    return NextResponse.json({
      success: true,
      message: 'Kedua formulir (Izin Masuk Alat IT & Koneksi Jaringan Internal) berhasil dikirim. Menunggu persetujuan & alokasi Username/IP dari Admin IT.',
      link: updatedLink,
    })
  } catch (error: any) {
    console.error('[api/it-guest-links/[id]] POST error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal mengirim formulir tamu' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Admin IT meng-approve / menolak serta mengalokasikan Username Jaringan + IP Address + Subnet + Gateway + DNS
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminFromRequest(request)
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (admin.role !== 'it' && admin.role !== 'ism_admin') {
      return NextResponse.json(
        { error: 'Akses ditolak: Hanya Admin IT atau ISMS Admin yang dapat memberikan persetujuan & akses jaringan.' },
        { status: 403 }
      )
    }

    const { id } = await params
    const existing = await resolveLink(id)
    if (!existing) {
      return NextResponse.json({ error: 'Data link tamu tidak ditemukan' }, { status: 404 })
    }

    const body = await request.json()
    const action: 'approve_form_1_manager' | 'approve_form_1' | 'approve' | 'approve_iaa' | 'reject' =
      body.action === 'reject'
        ? 'reject'
        : body.action === 'approve_form_1_manager'
        ? 'approve_form_1_manager'
        : body.action === 'approve_form_1'
        ? 'approve_form_1'
        : body.action === 'approve_iaa'
        ? 'approve_iaa'
        : 'approve'

    if (action === 'approve' && (!body.network_username?.trim() || !body.assigned_ip?.trim())) {
      return NextResponse.json(
        { error: 'Username Jaringan dan IP Address wajib diisi saat menyetujui akses jaringan tamu.' },
        { status: 400 }
      )
    }

    const updated = await approveOrRejectItGuestLink(existing.id, {
      action,
      approver_name:
        body.approver_name?.trim() ||
        (action === 'approve_iaa'
          ? 'TEGUH SUNJOYO'
          : action === 'approve_form_1_manager'
          ? 'Manager Departemen / IAA'
          : admin.username),
      also_approve_iaa: false,
      network_username: body.network_username,
      network_password: body.network_password,
      network_ssid: body.network_ssid,
      ip_mode: body.ip_mode,
      assigned_ip: body.assigned_ip,
      subnet_mask: body.subnet_mask,
      gateway: body.gateway,
      dns_primary: body.dns_primary,
      dns_secondary: body.dns_secondary,
      approval_notes: body.approval_notes,
      rejection_reason: body.rejection_reason,
    })

    return NextResponse.json({
      success: true,
      message:
        action === 'approve_form_1_manager'
          ? 'Tahap 1A Form 1 (IAA / Manager Departemen) berhasil disetujui! Selanjutnya silakan verifikasi Tahap 1B (Check IT / SSA).'
          : action === 'approve_form_1'
          ? 'Tahap 1B Form 1 (Verifikasi IT / SSA) berhasil disetujui! Sekarang Tamu dapat mengisi Formulir 2 (Penyambungan Jaringan).'
          : action === 'approve_iaa'
          ? 'Tahap Akhir (Approval IAA - Bpk. Teguh Sunjoyo) telah berhasil ditandatangani!'
          : action === 'approve'
          ? `Tahap 2A (IT Section Check) disetujui! Username (${updated.network_username}) & IP (${updated.assigned_ip}) telah dialokasikan.`
          : 'Pengajuan akses tamu telah ditolak.',
      link: updated,
    })
  } catch (error: any) {
    console.error('[api/it-guest-links/[id]] PATCH error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal memproses persetujuan link tamu' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await resolveLink(id)
    if (!existing) {
      return NextResponse.json({ error: 'Data link tamu tidak ditemukan' }, { status: 404 })
    }

    const ok = await deleteItGuestAccessLink(existing.id, true)
    if (!ok) {
      return NextResponse.json({ error: 'Gagal menghapus link tamu' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Data link tamu berhasil dihapus.',
    })
  } catch (error: any) {
    console.error('[api/it-guest-links/[id]] DELETE error:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus data link tamu' },
      { status: 500 }
    )
  }
}

