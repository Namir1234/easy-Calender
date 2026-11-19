import { describe, expect, it } from 'vitest'
import { createWheelPager, swipeStep } from './monthScroll'

const px = (
  deltaY: number,
  timeStamp: number
): Parameters<ReturnType<typeof createWheelPager>>[0] => ({
  deltaY,
  deltaMode: 0,
  timeStamp
})

describe('createWheelPager', () => {
  it('blättert mit jeder Raste am Mausrad einen Monat', () => {
    const pager = createWheelPager()
    expect(pager(px(100, 0))).toBe(1)
    expect(pager(px(100, 300))).toBe(1)
    expect(pager(px(-100, 600))).toBe(-1)
  })

  it('zählt Rasten, die zu schnell nacheinander kommen, nicht doppelt', () => {
    const pager = createWheelPager()
    expect(pager(px(100, 0))).toBe(1)
    expect(pager(px(100, 80))).toBe(0)
    expect(pager(px(100, 160))).toBe(0)
    expect(pager(px(100, 260))).toBe(1)
  })

  it('blättert bei einem Wisch auf dem Touchpad nur einen Monat, auch wenn er nachläuft', () => {
    const pager = createWheelPager()
    const steps: number[] = []
    // 1,5 Sekunden lang alle 16 ms kleine, langsam abklingende Schritte
    for (let t = 0; t <= 1500; t += 16) {
      const step = pager(px(Math.max(1, 30 - t / 50), t))
      if (step) steps.push(step)
    }
    expect(steps).toEqual([1])
  })

  it('blättert nach einer Pause mit der nächsten Bewegung wieder', () => {
    const pager = createWheelPager()
    let first = 0
    for (let t = 0; t <= 200; t += 16) first ||= pager(px(-20, t))
    expect(first).toBe(-1)
    let second = 0
    for (let t = 600; t <= 800; t += 16) second ||= pager(px(-20, t))
    expect(second).toBe(-1)
  })

  it('reagiert nicht auf ein kleines Zucken', () => {
    const pager = createWheelPager()
    expect(pager(px(10, 0))).toBe(0)
    expect(pager(px(10, 16))).toBe(0)
    // Nach einer Pause fängt die Summe neu an
    expect(pager(px(45, 400))).toBe(0)
  })

  it('rechnet Zeilen und Seiten in Pixel um', () => {
    expect(createWheelPager()({ deltaY: 3, deltaMode: 1, timeStamp: 0 })).toBe(1)
    expect(createWheelPager(600)({ deltaY: -1, deltaMode: 2, timeStamp: 0 })).toBe(-1)
  })
})

describe('swipeStep', () => {
  it('nach oben oder links ist der nächste Monat', () => {
    expect(swipeStep(5, -120, 200)).toBe(1)
    expect(swipeStep(-120, 10, 200)).toBe(1)
  })

  it('nach unten oder rechts ist der vorige Monat', () => {
    expect(swipeStep(0, 90, 200)).toBe(-1)
    expect(swipeStep(90, -20, 200)).toBe(-1)
  })

  it('kurzes Antippen und langes Halten blättern nicht', () => {
    expect(swipeStep(3, 4, 100)).toBe(0)
    expect(swipeStep(0, -200, 900)).toBe(0)
  })
})
