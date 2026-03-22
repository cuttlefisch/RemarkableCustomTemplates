import { describe, it, expect } from 'vitest'
import { computeViewBox, zoomAtPoint, clampPan } from '../lib/drawingViewport'

describe('computeViewBox', () => {
  it('returns full template at zoom 1 with no pan', () => {
    const vb = computeViewBox(1404, 1872, 1.0, { x: 0, y: 0 })
    expect(vb.x).toBeCloseTo(0)
    expect(vb.y).toBeCloseTo(0)
    expect(vb.w).toBeCloseTo(1404)
    expect(vb.h).toBeCloseTo(1872)
  })

  it('halves viewBox dimensions at zoom 2', () => {
    const vb = computeViewBox(1404, 1872, 2.0, { x: 0, y: 0 })
    expect(vb.w).toBeCloseTo(702)
    expect(vb.h).toBeCloseTo(936)
    // Centered
    expect(vb.x).toBeCloseTo(351)
    expect(vb.y).toBeCloseTo(468)
  })

  it('panning shifts the viewBox', () => {
    const vb = computeViewBox(1404, 1872, 1.0, { x: 100, y: 50 })
    expect(vb.x).toBeCloseTo(-100)
    expect(vb.y).toBeCloseTo(-50)
  })

  it('zoom 0.5 doubles viewBox dimensions', () => {
    const vb = computeViewBox(1404, 1872, 0.5, { x: 0, y: 0 })
    expect(vb.w).toBeCloseTo(2808)
    expect(vb.h).toBeCloseTo(3744)
  })
})

describe('zoomAtPoint', () => {
  it('increases zoom with positive delta', () => {
    const result = zoomAtPoint(1.0, { x: 0, y: 0 }, 0.5, { x: 702, y: 936 }, 1404, 1872)
    expect(result.zoom).toBeGreaterThan(1.0)
  })

  it('decreases zoom with negative delta', () => {
    const result = zoomAtPoint(1.0, { x: 0, y: 0 }, -0.5, { x: 702, y: 936 }, 1404, 1872)
    expect(result.zoom).toBeLessThan(1.0)
  })

  it('clamps zoom to minimum', () => {
    const result = zoomAtPoint(0.15, { x: 0, y: 0 }, -10, { x: 702, y: 936 }, 1404, 1872)
    expect(result.zoom).toBeGreaterThanOrEqual(0.1)
  })

  it('clamps zoom to maximum', () => {
    const result = zoomAtPoint(9.5, { x: 0, y: 0 }, 10, { x: 702, y: 936 }, 1404, 1872)
    expect(result.zoom).toBeLessThanOrEqual(10)
  })
})

describe('clampPan', () => {
  it('returns zero pan when within bounds', () => {
    const result = clampPan({ x: 0, y: 0 }, 1.0, 1404, 1872)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })

  it('clamps excessive positive pan', () => {
    const result = clampPan({ x: 10000, y: 10000 }, 1.0, 1404, 1872)
    expect(result.x).toBeLessThan(10000)
    expect(result.y).toBeLessThan(10000)
  })

  it('clamps excessive negative pan', () => {
    const result = clampPan({ x: -10000, y: -10000 }, 1.0, 1404, 1872)
    expect(result.x).toBeGreaterThan(-10000)
    expect(result.y).toBeGreaterThan(-10000)
  })

  it('allows larger pan at lower zoom', () => {
    const highZoom = clampPan({ x: 500, y: 500 }, 2.0, 1404, 1872)
    const lowZoom = clampPan({ x: 500, y: 500 }, 0.5, 1404, 1872)
    // At lower zoom, the viewBox is larger, so more pan is allowed
    expect(lowZoom.x).toBeGreaterThanOrEqual(highZoom.x)
  })
})
