import { MiniSparkline, RadialGauge, State } from './shared'
import type { WidgetRenderProps } from './types'

export function PerformanceWidget({ data, state, message, configuration }: WidgetRenderProps) {
  const metrics = data.performance?.metrics ?? []
  const history = data.performance?.history ?? []
  const perfStyle = String(configuration?.perfStyle ?? 'radial-gauges')

  const cpu = metrics.find(m => m.key === 'cpu')
  const ram = metrics.find(m => m.key === 'ram')
  const gpu = metrics.find(m => m.key === 'gpu')
  const disk = metrics.find(m => m.key === 'storage')

  const cpuPercent = cpu?.value ?? 0
  const ramPercent = ram?.value ?? 0
  const gpuAvailable = gpu?.state === 'ready' && typeof gpu.value === 'number'
  const gpuPercent = gpuAvailable ? gpu.value : null

  const cpuHistory = history.map(h => h.cpu).filter((val): val is number => typeof val === 'number')

  return (
    <section className={`widget-card performance-widget style-${perfStyle}`}>
      <State state={state} message={message}/>

      {state === 'ready' && (
        <>
          {perfStyle === 'radial-gauges' && (
            <div className="perf-radial-grid">
              <RadialGauge label="CPU" percent={cpuPercent} detail={cpu?.detail} color="#6ea8ff"/>
              <RadialGauge label="RAM" percent={ramPercent} detail={ram?.detail} color="#93d7a1"/>
              <RadialGauge label="GPU" percent={gpuPercent} detail={gpu?.detail ?? 'Not configured'} color="#d4a3ff"/>
            </div>
          )}

          {perfStyle === 'time-series-graph' && (
            <div className="perf-timeseries-view">
              <div className="timeseries-legend">
                <span className="legend-item cpu-legend">
                  <i/> CPU: <strong>{cpuPercent}%</strong>
                </span>
                <span className="legend-item ram-legend">
                  <i/> RAM: <strong>{ramPercent}%</strong>
                </span>
                {gpuAvailable && (
                  <span className="legend-item gpu-legend">
                    <i/> GPU: <strong>{gpuPercent}%</strong>
                  </span>
                )}
              </div>
              <div className="timeseries-chart-box">
                {cpuHistory.length >= 2 ? (
                  <MiniSparkline data={cpuHistory} stroke="#6ea8ff" fill="rgba(110, 168, 255, 0.2)" height={80}/>
                ) : (
                  <p className="widget-status">Collecting live samples…</p>
                )}
              </div>
              <div className="timeseries-footer">
                <small>Host Activity · Real-time streaming</small>
                {disk && <small>{disk.label}: {disk.detail}</small>}
              </div>
            </div>
          )}

          {perfStyle === 'kpi-stats' && (
            <div className="perf-kpi-grid">
              <div className="kpi-stat-card">
                <span className="kpi-label">CPU</span>
                <span className={`kpi-value ${cpuPercent > 80 ? 'warn' : ''}`}>{cpuPercent}%</span>
              </div>
              <div className="kpi-stat-card">
                <span className="kpi-label">RAM</span>
                <span className={`kpi-value ${ramPercent > 80 ? 'warn' : ''}`}>{ramPercent}%</span>
              </div>
              <div className="kpi-stat-card">
                <span className="kpi-label">GPU</span>
                <span className="kpi-value">{gpuPercent === null ? 'N/A' : `${gpuPercent}%`}</span>
              </div>
            </div>
          )}

          {perfStyle === 'horizontal-bars' && (
            <div className="metrics-list">
              {metrics.map(metric => {
                const val = typeof metric.value === 'number' ? metric.value : null
                return (
                  <div className="metric-row" key={metric.key}>
                    <div className="metric-label">
                      <span>{metric.label}</span>
                      <strong>{metric.detail ? `${metric.detail} · ` : ''}{val === null ? 'N/A' : `${val}%`}</strong>
                    </div>
                    <div className="metric-track">
                      <span
                        style={{
                          width: `${val === null ? 0 : Math.min(100, Math.max(0, val))}%`,
                          background: val !== null && val > 85 ? 'linear-gradient(90deg, #f2c276, #f08282)' : undefined
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function ServicesWidget({ data, state }: WidgetRenderProps) {
  return (
    <section className="widget-card services-widget">
      <State state={state}/>
      {state === 'ready' && (
        <div className="service-list">
          {data.services.map(service => (
            <div className="service-item" key={service.id ?? service.name}>
              <i className={`status-lamp ${service.status}`}/>
              <span>{service.name}</span>
              <small>{service.status}</small>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
