import * as React from 'react'
import { fetchWeather, type WeatherSnapshot, type WeatherUnits } from '../api'
import { RadialGauge } from './shared'
import type { WidgetRenderProps } from './types'

type WeatherCacheEntry = { data: WeatherSnapshot; fetchedAt: number }
const WEATHER_CLIENT_TTL_MS = 10 * 60_000
const weatherClientCache = new Map<string, WeatherCacheEntry>()

function useWeatherData(latitude: number, longitude: number, units: WeatherUnits) {
  const key = `${Math.round(latitude * 100) / 100},${Math.round(longitude * 100) / 100}:${units}`
  const [state, setState] = React.useState<{ key: string; data: WeatherSnapshot | null; status: 'loading' | 'ready' | 'offline' }>(() => {
    const cached = weatherClientCache.get(key)
    return { key, data: cached?.data ?? null, status: cached ? 'ready' : 'loading' }
  })

  React.useEffect(() => {
    const existing = weatherClientCache.get(key)
    if (existing && Date.now() - existing.fetchedAt < WEATHER_CLIENT_TTL_MS) {
      return
    }

    let cancelled = false
    const controller = new AbortController()

    const load = () => {
      fetchWeather(latitude, longitude, units, controller.signal)
        .then(result => {
          if (cancelled) return
          weatherClientCache.set(key, { data: result, fetchedAt: Date.now() })
          setState({ key, data: result, status: 'ready' })
        })
        .catch(() => {
          if (cancelled || controller.signal.aborted) return
          const fallback = weatherClientCache.get(key)
          setState({ key, data: fallback?.data ?? null, status: fallback ? 'ready' : 'offline' })
        })
    }

    load()
    const timer = window.setInterval(() => {
      if (!document.hidden) load()
    }, 15 * 60_000)

    return () => {
      cancelled = true
      controller.abort()
      window.clearInterval(timer)
    }
  }, [key, latitude, longitude, units])

  const cached = weatherClientCache.get(key)
  if (cached) {
    return { snapshot: cached.data, status: 'ready' as const }
  }
  if (state.key === key) {
    return { snapshot: state.data, status: state.status }
  }
  return { snapshot: null, status: 'loading' as const }
}

function describeWeatherCode(code: number): { label: string; kind: 'sun' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' } {
  if (code === 0) return { label: 'Clear sky', kind: 'sun' }
  if (code === 1 || code === 2) return { label: 'Partly cloudy', kind: 'partly' }
  if (code === 3) return { label: 'Overcast', kind: 'cloud' }
  if (code === 45 || code === 48) return { label: 'Fog', kind: 'fog' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return { label: code >= 61 ? 'Rain' : 'Drizzle', kind: 'rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: 'Snow', kind: 'snow' }
  if (code >= 95) return { label: 'Thunderstorm', kind: 'storm' }
  return { label: 'Cloudy', kind: 'cloud' }
}

function SkyIcon({ code, isDay = true, size = 32 }: { code: number; isDay?: boolean; size?: number }) {
  const { kind } = describeWeatherCode(code)
  if (kind === 'sun') {
    if (!isDay) {
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
          <path fill="#cfe0ff" d="M20.2 14.8A8.5 8.5 0 0 1 9.2 3.8a8.5 8.5 0 1 0 11 11Z"/>
        </svg>
      )
    }
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
        <circle cx="12" cy="12" r="5" fill="#fbbf24"/>
        <path stroke="#fde68a" strokeWidth="1.8" strokeLinecap="round" d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6"/>
      </svg>
    )
  }
  if (kind === 'partly') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
        <circle cx="9" cy="9" r="3.6" fill={isDay ? '#fbbf24' : '#cfe0ff'}/>
        <path fill="#e2ecf8" d="M9.5 19h8.2a3.3 3.3 0 0 0 .3-6.6 4.7 4.7 0 0 0-9-1.2A3.6 3.6 0 0 0 9.5 19Z"/>
      </svg>
    )
  }
  if (kind === 'rain') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
        <path fill="#c8daf0" d="M7.5 15.5h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.3 3.8 3.8 0 0 0-.3 8.3Z"/>
        <path stroke="#6ea8ff" strokeWidth="1.8" strokeLinecap="round" d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/>
      </svg>
    )
  }
  if (kind === 'storm') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
        <path fill="#9fb5d1" d="M7.5 14.8h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.3 3.8 3.8 0 0 0-.3 8.3Z"/>
        <path fill="#fbbf24" d="M13 13.5 9.8 18h2.6l-.8 3.8 4.4-5.3h-2.7l.7-3Z"/>
      </svg>
    )
  }
  if (kind === 'snow') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
        <path fill="#dce8f8" d="M7.5 15h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.3 3.8 3.8 0 0 0-.3 8.3Z"/>
        <circle cx="9.5" cy="18.5" r="1.2" fill="#fff"/>
        <circle cx="13.5" cy="19.5" r="1.2" fill="#fff"/>
        <circle cx="16.8" cy="18.2" r="1.2" fill="#fff"/>
      </svg>
    )
  }
  if (kind === 'fog') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
        <path stroke="#c4d4e8" strokeWidth="2" strokeLinecap="round" d="M4 9h16M3 13h18M6 17h12"/>
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className="weather-svg" aria-hidden="true">
      <path fill="#d6e4f5" d="M7.5 17.5h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.3 3.8 3.8 0 0 0-.3 8.3Z"/>
    </svg>
  )
}

function getComfortLabel(humidity: number): { label: string; tone: 'dry' | 'optimal' | 'humid' } {
  if (humidity < 40) return { label: 'Dry', tone: 'dry' }
  if (humidity <= 60) return { label: 'Optimal', tone: 'optimal' }
  return { label: 'Humid', tone: 'humid' }
}

export function WeatherForecastWidget({ configuration }: WidgetRenderProps) {
  const locationName = String(configuration?.locationName || 'Madrid')
  const latitude = Number(configuration?.latitude ?? 40.42)
  const longitude = Number(configuration?.longitude ?? -3.7)
  const units: WeatherUnits = configuration?.units === 'imperial' ? 'imperial' : 'metric'
  const weatherStyle = String(configuration?.weatherStyle ?? 'card-detailed')

  const { snapshot, status } = useWeatherData(
    Number.isFinite(latitude) ? latitude : 40.42,
    Number.isFinite(longitude) ? longitude : -3.7,
    units
  )

  const tempUnit = units === 'imperial' ? '°F' : '°C'
  const windUnit = units === 'imperial' ? 'mph' : 'km/h'

  if (status === 'loading' && !snapshot) {
    return (
      <section className={`widget-card weather-widget style-${weatherStyle}`}>
        <p className="widget-status">Loading weather…</p>
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className={`widget-card weather-widget style-${weatherStyle}`}>
        <p className="widget-status"><i className="status-lamp offline"/>Weather unavailable</p>
      </section>
    )
  }

  const desc = describeWeatherCode(snapshot.current.weatherCode)
  const currentTemp = Math.round(snapshot.current.temperature)
  const feelsLike = Math.round(snapshot.current.apparentTemperature)

  if (weatherStyle === 'card-compact') {
    return (
      <section className="widget-card weather-widget style-card-compact">
        <div className="weather-compact-top">
          <SkyIcon code={snapshot.current.weatherCode} isDay={snapshot.current.isDay} size={34}/>
          <strong className="weather-compact-temp">{currentTemp}{tempUnit}</strong>
        </div>
        <div className="weather-compact-meta">
          <span className="weather-location">{locationName}</span>
          <small>Feels {feelsLike}{tempUnit} · {desc.label}</small>
        </div>
      </section>
    )
  }

  if (weatherStyle === 'hourly-forecast') {
    return (
      <section className="widget-card weather-widget style-hourly-forecast">
        <div className="weather-header-row">
          <div>
            <strong className="weather-location">{locationName}</strong>
            <small className="weather-desc">{desc.label}</small>
          </div>
          <div className="weather-header-temp">
            <SkyIcon code={snapshot.current.weatherCode} isDay={snapshot.current.isDay} size={24}/>
            <strong>{currentTemp}{tempUnit}</strong>
          </div>
        </div>
        <div className="weather-hourly-strip">
          {snapshot.hourly.slice(0, 12).map(point => {
            const hourLabel = point.time.slice(11, 16) || point.time
            return (
              <div className="weather-hour-pill" key={point.time}>
                <span className="hour-time">{hourLabel}</span>
                <SkyIcon code={point.weatherCode} isDay size={20}/>
                <strong className="hour-temp">{Math.round(point.temperature)}°</strong>
                {point.precipitationProbability !== null && point.precipitationProbability > 0 && (
                  <small className="hour-rain">{point.precipitationProbability}%</small>
                )}
              </div>
            )
          })}
        </div>
      </section>
    )
  }

  return (
    <section className="widget-card weather-widget style-card-detailed">
      <div className="weather-detailed-top">
        <div className="weather-main-temp-block">
          <span className="weather-location">{locationName}</span>
          <strong className="weather-hero-temp">{currentTemp}{tempUnit}</strong>
          <small className="weather-desc">{desc.label} · Feels {feelsLike}{tempUnit}</small>
        </div>
        <div className="weather-hero-icon">
          <SkyIcon code={snapshot.current.weatherCode} isDay={snapshot.current.isDay} size={48}/>
        </div>
      </div>
      <div className="weather-stats-row">
        {snapshot.daily.tempMax !== null && snapshot.daily.tempMin !== null && (
          <span className="weather-stat-chip">
            H {Math.round(snapshot.daily.tempMax)}° · L {Math.round(snapshot.daily.tempMin)}°
          </span>
        )}
        <span className="weather-stat-chip">Wind {Math.round(snapshot.current.windSpeed)} {windUnit}</span>
        {snapshot.daily.precipitationProbabilityMax !== null && (
          <span className="weather-stat-chip">Rain {snapshot.daily.precipitationProbabilityMax}%</span>
        )}
      </div>
    </section>
  )
}

export function EnvironmentSensorWidget({ configuration }: WidgetRenderProps) {
  const locationName = String(configuration?.locationName || 'Madrid')
  const latitude = Number(configuration?.latitude ?? 40.42)
  const longitude = Number(configuration?.longitude ?? -3.7)
  const units: WeatherUnits = configuration?.units === 'imperial' ? 'imperial' : 'metric'
  const sensorStyle = String(configuration?.sensorStyle ?? 'radial-gauge')
  const showComfortIndex = configuration?.showComfortIndex !== false

  const { snapshot, status } = useWeatherData(
    Number.isFinite(latitude) ? latitude : 40.42,
    Number.isFinite(longitude) ? longitude : -3.7,
    units
  )

  const tempUnit = units === 'imperial' ? '°F' : '°C'

  if (status === 'loading' && !snapshot) {
    return (
      <section className={`widget-card env-sensor-widget style-${sensorStyle}`}>
        <p className="widget-status">Loading sensor…</p>
      </section>
    )
  }

  if (!snapshot) {
    return (
      <section className={`widget-card env-sensor-widget style-${sensorStyle}`}>
        <p className="widget-status"><i className="status-lamp offline"/>Sensor unavailable</p>
      </section>
    )
  }

  const humidity = snapshot.current.humidity
  const comfort = getComfortLabel(humidity)
  const dewDetail = snapshot.current.dewPoint !== null ? `Dew ${Math.round(snapshot.current.dewPoint)}${tempUnit}` : locationName

  if (sensorStyle === 'compact-chip') {
    return (
      <section className="widget-card env-sensor-widget style-compact-chip">
        <div className="env-chip-top">
          <svg viewBox="0 0 24 24" width="22" height="22" className="env-drop-svg" aria-hidden="true">
            <path fill="#22d3ee" d="M12 2.6C8.3 7.4 5.5 11.1 5.5 14.5a6.5 6.5 0 0 0 13 0c0-3.4-2.8-7.1-6.5-11.9Z"/>
          </svg>
          <strong className="env-chip-value">{humidity}%</strong>
          {showComfortIndex && (
            <span className={`env-comfort-badge tone-${comfort.tone}`}>{comfort.label}</span>
          )}
        </div>
        <small className="env-chip-sub">{locationName} · {dewDetail}</small>
      </section>
    )
  }

  if (sensorStyle === 'dual-sensor') {
    return (
      <section className="widget-card env-sensor-widget style-dual-sensor">
        <div className="env-dual-header">
          <span>{locationName}</span>
          {showComfortIndex && (
            <span className={`env-comfort-badge tone-${comfort.tone}`}>{comfort.label}</span>
          )}
        </div>
        <div className="env-dual-grid">
          <div className="env-dual-tile">
            <span className="env-dual-label">TEMP</span>
            <strong className="env-dual-val">{Math.round(snapshot.current.temperature)}{tempUnit}</strong>
          </div>
          <div className="env-dual-tile">
            <span className="env-dual-label">HUMIDITY</span>
            <strong className="env-dual-val humidity">{humidity}%</strong>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="widget-card env-sensor-widget style-radial-gauge">
      <RadialGauge
        label="Humidity"
        percent={humidity}
        detail={showComfortIndex ? `${comfort.label} · ${dewDetail}` : dewDetail}
        color="#22d3ee"
      />
    </section>
  )
}
