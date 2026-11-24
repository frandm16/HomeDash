import assert from 'node:assert/strict'
import test from 'node:test'
import { createWeatherService, isValidCoordinates } from './weather.js'

test('weather coordinate validator enforces valid latitude and longitude bounds', () => {
  assert.equal(isValidCoordinates(40.42, -3.7), true)
  assert.equal(isValidCoordinates(-90, 180), true)
  assert.equal(isValidCoordinates(91, 0), false)
  assert.equal(isValidCoordinates(0, -181), false)
  assert.equal(isValidCoordinates(Number.NaN, 0), false)
})

test('weather service normalizes Open-Meteo forecast and caches concurrent calls', async () => {
  let calls = 0
  const mockFetch = (async () => {
    calls += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return new Response(JSON.stringify({
      timezone: 'Europe/Madrid',
      current: {
        time: '2026-11-24T12:00',
        temperature_2m: 18.4,
        relative_humidity_2m: 54,
        apparent_temperature: 17.8,
        weather_code: 2,
        wind_speed_10m: 11.2,
        dew_point_2m: 8.9,
        is_day: 1,
      },
      daily: {
        temperature_2m_max: [21.3],
        temperature_2m_min: [9.6],
        precipitation_probability_max: [15],
      },
      hourly: {
        time: ['2026-11-24T11:00', '2026-11-24T12:00', '2026-11-24T13:00'],
        temperature_2m: [17.1, 18.4, 19.2],
        weather_code: [1, 2, 3],
        precipitation_probability: [5, 10, 15],
        relative_humidity_2m: [58, 54, 50],
      },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as typeof fetch

  const service = createWeatherService({ fetchImpl: mockFetch, freshTtlMs: 60_000 })
  const [first, second] = await Promise.all([
    service.getWeather(40.4168, -3.7038, 'metric'),
    service.getWeather(40.4171, -3.7041, 'metric'),
  ])

  assert.equal(calls, 1)
  assert.equal(first.current.temperature, 18.4)
  assert.equal(first.current.humidity, 54)
  assert.equal(first.daily.tempMax, 21.3)
  assert.equal(first.hourly.length, 2)
  assert.equal(first.hourly[0].time, '2026-11-24T12:00')
  assert.equal(second.fetchedAt, first.fetchedAt)
})

test('weather service searches locations via geocoding API', async () => {
  const mockFetch = (async () => new Response(JSON.stringify({
    results: [
      { name: 'Madrid', country: 'Spain', admin1: 'Madrid', latitude: 40.4165, longitude: -3.70256 },
    ],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as typeof fetch

  const service = createWeatherService({ fetchImpl: mockFetch })
  const results = await service.searchLocations('Madrid')
  assert.equal(results.length, 1)
  assert.equal(results[0].name, 'Madrid')
  assert.equal(results[0].country, 'Spain')
  assert.equal(results[0].latitude, 40.417)
})
