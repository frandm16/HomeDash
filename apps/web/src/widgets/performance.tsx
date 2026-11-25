import type { PerformanceMetric, PerformanceNodeKind, PerformanceNodeSnapshot } from '../api'
import { MiniSparkline, RadialGauge, State } from './shared'
import type { WidgetRenderProps } from './types'

const KIND_LABELS: Record<PerformanceNodeKind, string> = {
  host: 'PROXMOX',
  vm: 'VM',
  lxc: 'LXC',
}

function pickMetrics(metrics: PerformanceMetric[]) {
  const cpu = metrics.find(m => m.key === 'cpu')
  const ram = metrics.find(m => m.key === 'ram')
  const disk = metrics.find(m => m.key === 'storage')
  const cpuPercent = cpu?.state === 'ready' && typeof cpu.value === 'number' ? cpu.value : null
  const ramPercent = ram?.state === 'ready' && typeof ram.value === 'number' ? ram.value : null
  const diskPercent = disk?.state === 'ready' && typeof disk.value === 'number' ? disk.value : null
  return { cpu, ram, disk, cpuPercent, ramPercent, diskPercent }
}

function NodeHeader({ node }: { node: PerformanceNodeSnapshot }) {
  const lampClass = node.status === 'online' ? 'online' : 'offline'
  return (
    <div className="perf-node-header">
      <div className="perf-node-title">
        <i className={`status-lamp ${lampClass}`}/>
        <span className={`perf-node-badge kind-${node.kind}`}>{KIND_LABELS[node.kind]}</span>
        <strong className="perf-node-name">{node.name}</strong>
      </div>
      {node.vmid !== undefined && <span className="perf-node-vmid">#{node.vmid}</span>}
    </div>
  )
}

function MetricBars({ metrics }: { metrics: PerformanceMetric[] }) {
  const ordered = ['cpu', 'ram', 'storage']
    .map(key => metrics.find(m => m.key === key))
    .filter((m): m is PerformanceMetric => Boolean(m))

  return (
    <div className="metrics-list">
      {ordered.map(metric => {
        const val = typeof metric.value === 'number' ? metric.value : null
        return (
          <div className="metric-row" key={metric.key}>
            <div className="metric-label">
              <span>{metric.label}</span>
              <strong>{metric.detail ? `${metric.detail}${val !== null ? ' · ' : ''}` : ''}{val === null ? (metric.detail ? '' : 'N/A') : `${val}%`}</strong>
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
  )
}

export function PerformanceWidget({ data, state, message, configuration }: WidgetRenderProps) {
  const metrics = data.performance?.metrics ?? []
  const history = data.performance?.history ?? []
  const nodes = data.performance?.nodes ?? []
  const perfStyle = String(configuration?.perfStyle ?? 'radial-gauges')
  const isMultiNode = nodes.length > 1

  const { cpu, ram, disk, cpuPercent, ramPercent, diskPercent } = pickMetrics(metrics)
  const cpuHistory = history.map(h => h.cpu).filter((val): val is number => typeof val === 'number')

  return (
    <section className={`widget-card performance-widget style-${perfStyle}${isMultiNode ? ' multi-node' : ''}`}>
      <State state={state} message={message}/>

      {state === 'ready' && (
        <>
          {perfStyle === 'radial-gauges' && (
            isMultiNode ? (
              <div className="perf-nodes-stack">
                {nodes.map(node => {
                  const m = pickMetrics(node.metrics)
                  return (
                    <div className="perf-node-block" key={node.id}>
                      <NodeHeader node={node}/>
                      <div className="perf-radial-grid compact">
                        <RadialGauge label="CPU" percent={m.cpuPercent} detail={m.cpu?.detail} color="#6ea8ff" compact/>
                        <RadialGauge label="RAM" percent={m.ramPercent} detail={m.ram?.detail} color="#93d7a1" compact/>
                        <RadialGauge label="Disk" percent={m.diskPercent} detail={m.disk?.detail} color="#d4a3ff" compact/>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="perf-radial-grid">
                <RadialGauge label="CPU" percent={cpuPercent} detail={cpu?.detail} color="#6ea8ff"/>
                <RadialGauge label="RAM" percent={ramPercent} detail={ram?.detail} color="#93d7a1"/>
                <RadialGauge label="Disk" percent={diskPercent} detail={disk?.detail} color="#d4a3ff"/>
              </div>
            )
          )}

          {perfStyle === 'time-series-graph' && (
            <div className="perf-timeseries-view">
              <div className="timeseries-legend">
                <span className="legend-item cpu-legend">
                  <i/> CPU: <strong>{cpuPercent === null ? '—' : `${cpuPercent}%`}</strong>
                </span>
                <span className="legend-item ram-legend">
                  <i/> RAM: <strong>{ramPercent === null ? '—' : `${ramPercent}%`}</strong>
                </span>
                <span className="legend-item disk-legend">
                  <i/> Disk: <strong>{diskPercent === null ? '—' : `${diskPercent}%`}</strong>
                </span>
              </div>
              <div className="timeseries-chart-box">
                {cpuHistory.length >= 2 ? (
                  <MiniSparkline data={cpuHistory} stroke="#6ea8ff" fill="rgba(110, 168, 255, 0.2)" height={isMultiNode ? 56 : 80}/>
                ) : (
                  <p className="widget-status">Collecting live samples…</p>
                )}
              </div>
              {isMultiNode ? (
                <div className="perf-guest-summary-list">
                  {nodes.slice(1).map(node => {
                    const m = pickMetrics(node.metrics)
                    return (
                      <div className="perf-guest-summary-row" key={node.id}>
                        <div className="perf-node-title">
                          <i className={`status-lamp ${node.status === 'online' ? 'online' : 'offline'}`}/>
                          <span className={`perf-node-badge kind-${node.kind}`}>{KIND_LABELS[node.kind]}</span>
                          <strong className="perf-node-name">{node.name}</strong>
                        </div>
                        <div className="perf-guest-inline-metrics">
                          <span>CPU <strong>{m.cpuPercent === null ? '—' : `${m.cpuPercent}%`}</strong></span>
                          <span>RAM <strong>{m.ramPercent === null ? '—' : `${m.ramPercent}%`}</strong></span>
                          <span>Disk <strong>{m.diskPercent === null ? (m.disk?.detail ?? '—') : `${m.diskPercent}%`}</strong></span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="timeseries-footer">
                  <small>Host Activity · Real-time streaming</small>
                  {disk && <small>{disk.label}: {disk.detail}</small>}
                </div>
              )}
            </div>
          )}

          {perfStyle === 'kpi-stats' && (
            isMultiNode ? (
              <div className="perf-nodes-stack">
                {nodes.map(node => {
                  const m = pickMetrics(node.metrics)
                  return (
                    <div className="perf-node-block" key={node.id}>
                      <NodeHeader node={node}/>
                      <div className="perf-kpi-grid compact">
                        <div className="kpi-stat-card compact">
                          <span className="kpi-label">CPU</span>
                          <span className={`kpi-value ${m.cpuPercent !== null && m.cpuPercent > 80 ? 'warn' : ''}`}>{m.cpuPercent === null ? '—' : `${m.cpuPercent}%`}</span>
                        </div>
                        <div className="kpi-stat-card compact">
                          <span className="kpi-label">RAM</span>
                          <span className={`kpi-value ${m.ramPercent !== null && m.ramPercent > 80 ? 'warn' : ''}`}>{m.ramPercent === null ? '—' : `${m.ramPercent}%`}</span>
                        </div>
                        <div className="kpi-stat-card compact">
                          <span className="kpi-label">Disk</span>
                          <span className={`kpi-value ${m.diskPercent !== null && m.diskPercent > 80 ? 'warn' : ''}`}>{m.diskPercent === null ? '—' : `${m.diskPercent}%`}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="perf-kpi-grid">
                <div className="kpi-stat-card">
                  <span className="kpi-label">CPU</span>
                  <span className={`kpi-value ${cpuPercent !== null && cpuPercent > 80 ? 'warn' : ''}`}>{cpuPercent === null ? '—' : `${cpuPercent}%`}</span>
                </div>
                <div className="kpi-stat-card">
                  <span className="kpi-label">RAM</span>
                  <span className={`kpi-value ${ramPercent !== null && ramPercent > 80 ? 'warn' : ''}`}>{ramPercent === null ? '—' : `${ramPercent}%`}</span>
                </div>
                <div className="kpi-stat-card">
                  <span className="kpi-label">Disk</span>
                  <span className={`kpi-value ${diskPercent !== null && diskPercent > 80 ? 'warn' : ''}`}>{diskPercent === null ? '—' : `${diskPercent}%`}</span>
                </div>
              </div>
            )
          )}

          {perfStyle === 'horizontal-bars' && (
            isMultiNode ? (
              <div className="perf-nodes-stack">
                {nodes.map(node => (
                  <div className="perf-node-block" key={node.id}>
                    <NodeHeader node={node}/>
                    <MetricBars metrics={node.metrics}/>
                  </div>
                ))}
              </div>
            ) : (
              <MetricBars metrics={metrics}/>
            )
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
