import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyCnDate,
  extractTimorYearHolidayData,
  normalizeYYYYMMDD,
  toYYYYMMDD,
} from '../src/utils/cnHolidayCore.js'

test('normalizeYYYYMMDD', () => {
  assert.equal(normalizeYYYYMMDD('2026-6-5'), '2026-06-05')
  assert.equal(normalizeYYYYMMDD('06-05', 2026), '2026-06-05')
  assert.equal(normalizeYYYYMMDD('bad'), null)
})

test('toYYYYMMDD', () => {
  assert.equal(toYYYYMMDD(new Date('2026-06-15T12:00:00Z')).startsWith('2026-'), true)
})

test('classifyCnDate: normal / holiday / workday', () => {
  const dataset = {
    holidays: ['2026-10-01'],
    workdays: ['2026-10-11'],
  }
  assert.equal(classifyCnDate('2026-06-16', dataset), 'normal')
  assert.equal(classifyCnDate('2026-10-01', dataset), 'holiday')
  assert.equal(classifyCnDate('2026-10-11', dataset), 'workday')
})

test('extractTimorYearHolidayData', () => {
  const data = {
    code: 0,
    holiday: {
      '10-01': { holiday: true, name: '国庆节' },
      '10-07': { holiday: false, name: '国庆节后调休', target: '国庆节' },
      '2026-01-01': { holiday: true, name: '元旦', date: '2026-01-01' },
    },
  }
  const r = extractTimorYearHolidayData(2026, data)
  assert.deepEqual(r.holidays, ['2026-01-01', '2026-10-01'])
  assert.deepEqual(r.workdays, ['2026-10-07'])
})

test('extractTimorYearHolidayData throws on bad response', () => {
  assert.throws(() => extractTimorYearHolidayData(2026, { code: -1 }))
})

