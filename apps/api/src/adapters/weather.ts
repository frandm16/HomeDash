export type WeatherUnits = 'metric' | 'imperial'

export type WeatherHourlyPoint = {
  time: string
  temperature: number
  weatherCode: number
  precipitationProbability: number | null
  humidity: number | null
}

export type WeatherSnapshot = {
  latitude: number
  longitude: number
  units: WeatherUnits
  timezone: string
  current: {
    temperature: number
    apparentTemperature: number
    humidity: number
    dewPoint: number | null
    windSpeed: number
    weatherCode: number
    isDay: boolean
  }
  daily: {
    tempMax: number | null
    tempMin: number | null
    precipitationProbabilityMax: number | null
  }
  hourly: WeatherHourlyPoint[]
  fetchedAt: string
}

export type WeatherLocationResult = {
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
}

type OpenMeteoForecastResponse = {
  timezone?: string
  current?: {
    time?: string
    temperature_2m?: number
    relative_humidity_2m?: number
    apparent_temperature?: number
    weather_code?: number
    wind_speed_10m?: number
    dew_point_2m?: number
    is_day?: number
  }
  daily?: {
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: number[]
  }
  hourly?: {
    time?: string[]
    temperature_2m?: number[]
    weather_code?: number[]
    precipitation_probability?: number[]
    relative_humidity_2m?: number[]
  }
}

type OpenMeteoGeocodingResponse = {
  results?: Array<{
    name?: string
    country?: string
    admin1?: string
    latitude?: number
    longitude?: number
  }>
}

type WeatherServiceOptions = {
  fetchImpl?: typeof fetch
  freshTtlMs?: number
  maxStaleMs?: number
  timeoutMs?: number
  maxEntries?: number
}

export function isValidCoordinates(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

function normalizeForecast(
  lat: number,
  lon: number,
  units: WeatherUnits,
  payload: OpenMeteoForecastResponse,
  nowMs: number
): WeatherSnapshot {
  const current = payload.current
  if (!current || typeof current.temperature_2m !== 'number') {
    throw new Error('Invalid weather response payload')
  }

  const times = payload.hourly?.time ?? []
  const temps = payload.hourly?.temperature_2m ?? []
  const codes = payload.hourly?.weather_code ?? []
  const precip = payload.hourly?.precipitation_probability ?? []
  const humidities = payload.hourly?.relative_humidity_2m ?? []

  const currentIso = current.time ?? ''
  let startIdx = currentIso ? times.findIndex(t => t >= currentIso) : 0
  if (startIdx < 0) startIdx = 0

  const hourly: WeatherHourlyPoint[] = []
  for (let i = startIdx; i < Math.min(times.length, startIdx + 12); i++) {
    const temp = temps[i]
    if (typeof temp !== 'number') continue
    hourly.push({
      time: times[i],
      temperature: Math.round(temp * 10) / 10,
      weatherCode: typeof codes[i] === 'number' ? codes[i] : 0,
      precipitationProbability: typeof precip[i] === 'number' ? Math.round(precip[i]) : null,
      humidity: typeof humidities[i] === 'number' ? Math.round(humidities[i]) : null,
    })
  }

  return {
    latitude: lat,
    longitude: lon,
    units,
    timezone: payload.timezone ?? 'UTC',
    current: {
      temperature: Math.round(current.temperature_2m * 10) / 10,
      apparentTemperature: Math.round((current.apparent_temperature ?? current.temperature_2m) * 10) / 10,
      humidity: Math.round(current.relative_humidity_2m ?? 0),
      dewPoint: typeof current.dew_point_2m === 'number' ? Math.round(current.dew_point_2m * 10) / 10 : null,
      windSpeed: Math.round((current.wind_speed_10m ?? 0) * 10) / 10,
      weatherCode: typeof current.weather_code === 'number' ? current.weather_code : 0,
      isDay: current.is_day !== 0,
    },
    daily: {
      tempMax: typeof payload.daily?.temperature_2m_max?.[0] === 'number'
        ? Math.round(payload.daily.temperature_2m_max[0] * 10) / 10
        : null,
      tempMin: typeof payload.daily?.temperature_2m_min?.[0] === 'number'
        ? Math.round(payload.daily.temperature_2m_min[0] * 10) / 10
        : null,
      precipitationProbabilityMax: typeof payload.daily?.precipitation_probability_max?.[0] === 'number'
        ? Math.round(payload.daily.precipitation_probability_max[0])
        : null,
    },
    hourly,
    fetchedAt: new Date(nowMs).toISOString(),
  }
}

export function createWeatherService(options: WeatherServiceOptions = {}) {
  const fetchImpl = options.fetchImpl ?? fetch
  const freshTtlMs = options.freshTtlMs ?? 15 * 60_000
  const maxStaleMs = options.maxStaleMs ?? 60 * 60_000
  const timeoutMs = options.timeoutMs ?? 4_000
  const maxEntries = options.maxEntries ?? 64

  const cache = new Map<string, { value: WeatherSnapshot; fetchedAt: number }>()
  const inFlight = new Map<string, Promise<WeatherSnapshot>>()

  function evictIfNeeded() {
    if (cache.size < maxEntries) return
    const oldestKey = cache.keys().next().value
    if (oldestKey) cache.delete(oldestKey)
  }

  async function fetchForecast(lat: number, lon: number, units: WeatherUnits, cacheKey: string): Promise<WeatherSnapshot> {
    const existing = inFlight.get(cacheKey)
    if (existing) return existing

    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,dew_point_2m,is_day',
      hourly: 'temperature_2m,weather_code,precipitation_probability,relative_humidity_2m',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '2',
      timezone: 'auto',
      temperature_unit: units === 'imperial' ? 'fahrenheit' : 'celsius',
      wind_speed_unit: units === 'imperial' ? 'mph' : 'kmh',
    })

    const promise = (async () => {
      const response = await fetchImpl(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        throw new Error(`Open-Meteo returned ${response.status}`)
      }
      const data = await response.json() as OpenMeteoForecastResponse
      const now = Date.now()
      const snapshot = normalizeForecast(lat, lon, units, data, now)
      evictIfNeeded()
      cache.set(cacheKey, { value: snapshot, fetchedAt: now })
      return snapshot
    })().finally(() => {
      inFlight.delete(cacheKey)
    })

    inFlight.set(cacheKey, promise)
    return promise
  }

  return {
    async getWeather(latitude: number, longitude: number, units: WeatherUnits = 'metric'): Promise<WeatherSnapshot> {
      if (!isValidCoordinates(latitude, longitude)) {
        throw new Error('Invalid coordinates')
      }
      const roundedLat = Math.round(latitude * 100) / 100
      const roundedLon = Math.round(longitude * 100) / 100
      const cacheKey = `${roundedLat},${roundedLon}:${units}`
      const now = Date.now()
      const entry = cache.get(cacheKey)

      if (entry) {
        const age = now - entry.fetchedAt
        if (age < freshTtlMs) return entry.value
        if (age < maxStaleMs) {
          void fetchForecast(roundedLat, roundedLon, units, cacheKey).catch(() => undefined)
          return entry.value
        }
      }

      return fetchForecast(roundedLat, roundedLon, units, cacheKey)
    },

    async searchLocations(query: string): Promise<WeatherLocationResult[]> {
      const trimmed = query.trim()
      if (trimmed.length < 2) return []
      const params = new URLSearchParams({
        name: trimmed,
        count: '5',
        language: 'en',
        format: 'json',
      })
      const response = await fetchImpl(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        throw new Error(`Open-Meteo geocoding returned ${response.status}`)
      }
      const data = await response.json() as OpenMeteoGeocodingResponse
      return (data.results ?? [])
        .filter((item): item is Required<Pick<WeatherLocationResult, 'name' | 'latitude' | 'longitude'>> & { country?: string; admin1?: string } =>
          typeof item.name === 'string' && typeof item.latitude === 'number' && typeof item.longitude === 'number'
        )
        .map(item => ({
          name: item.name,
          country: item.country ?? '',
          ...(item.admin1 ? { admin1: item.admin1 } : {}),
          latitude: Math.round(item.latitude * 1000) / 1000,
          longitude: Math.round(item.longitude * 1000) / 1000,
        }))
    },
  }
}
