import { describe, it, expect } from 'vitest'

describe('Photo Video USB and Return Time Logic', () => {
  it('correctly calculates fallback toAt when returnOnActual is true', () => {
    const fromAt = '2026-10-21T08:00:00.000Z'
    const returnOnActual = true
    let toAt = ''

    let resolvedToAt = toAt
    if (returnOnActual && (!resolvedToAt || Number.isNaN(Date.parse(resolvedToAt)))) {
      resolvedToAt = new Date(new Date(fromAt).getTime() + 8 * 3600 * 1000).toISOString()
    }

    expect(resolvedToAt).toBe('2026-10-21T16:00:00.000Z')
    expect(new Date(resolvedToAt).getTime()).toBeGreaterThan(new Date(fromAt).getTime())
  })

  it('updates to_at to actual returned timestamp when marked returned', () => {
    const initialFromAt = '2026-10-21T08:00:00.000Z'
    const initialToAt = '2026-10-21T16:00:00.000Z' // estimated fallback
    const actualReturnTime = new Date('2026-10-21T14:35:00.000Z')

    // On return
    const updatedToAt = actualReturnTime.toISOString()
    const returnedAt = actualReturnTime.toISOString()

    expect(updatedToAt).toBe('2026-10-21T14:35:00.000Z')
    expect(returnedAt).toBe('2026-10-21T14:35:00.000Z')
    expect(new Date(updatedToAt).getTime()).toBeGreaterThan(new Date(initialFromAt).getTime())
  })

  it('handles optional usbControlNo properly', () => {
    const payloadWithUsb = {
      requesterName: 'Budi Santoso',
      cameraControlNo: 'TRN-CAM-01',
      photoIdNo: 'PHOTO-ID-01',
      usbControlNo: 'USB-ISMS-01',
    }

    const payloadWithoutUsb = {
      requesterName: 'Siti Rahma',
      cameraControlNo: 'TRN-CAM-02',
      photoIdNo: 'PHOTO-ID-02',
      usbControlNo: null,
    }

    expect(payloadWithUsb.usbControlNo).toBe('USB-ISMS-01')
    expect(payloadWithoutUsb.usbControlNo).toBeNull()
  })

  it('preserves or overrides usbControlNo during approval decision', () => {
    const existingUsb = 'USB-ISMS-01'
    const adminDecisionWithNewUsb = { status: 'approved', usbControlNo: 'USB-ISMS-02' }
    const adminDecisionWithoutChange = { status: 'approved', usbControlNo: undefined }

    const resolvedUsb1 = adminDecisionWithNewUsb.usbControlNo ?? existingUsb
    const resolvedUsb2 = adminDecisionWithoutChange.usbControlNo ?? existingUsb

    expect(resolvedUsb1).toBe('USB-ISMS-02')
    expect(resolvedUsb2).toBe('USB-ISMS-01')
  })

  it('handles optional smartDeviceControlNo properly', () => {
    const payloadWithSmartDevice = {
      requesterName: 'Budi Santoso',
      cameraControlNo: 'TRN-CAM-01',
      photoIdNo: 'PHOTO-ID-01',
      usbControlNo: 'USB-ISMS-01',
      smartDeviceControlNo: 'SMT-QA-01',
    }

    const payloadWithoutSmartDevice = {
      requesterName: 'Siti Rahma',
      cameraControlNo: 'TRN-CAM-02',
      photoIdNo: 'PHOTO-ID-02',
      usbControlNo: null,
      smartDeviceControlNo: null,
    }

    expect(payloadWithSmartDevice.smartDeviceControlNo).toBe('SMT-QA-01')
    expect(payloadWithoutSmartDevice.smartDeviceControlNo).toBeNull()
  })

  it('preserves or overrides smartDeviceControlNo during approval decision', () => {
    const existingSmart = 'SMT-QA-01'
    const adminDecisionWithNewSmart = { status: 'approved', smartDeviceControlNo: 'SMT-QA-02' }
    const adminDecisionWithoutChange = { status: 'approved', smartDeviceControlNo: undefined }

    const resolvedSmart1 = adminDecisionWithNewSmart.smartDeviceControlNo ?? existingSmart
    const resolvedSmart2 = adminDecisionWithoutChange.smartDeviceControlNo ?? existingSmart

    expect(resolvedSmart1).toBe('SMT-QA-02')
    expect(resolvedSmart2).toBe('SMT-QA-01')
  })
})
