import assert from 'node:assert/strict'
import test from 'node:test'
import { mapProxmoxResourcesToNodes, type ProxmoxClusterResource } from './proxmox.js'

test('mapProxmoxResourcesToNodes orders host, VMs, then LXCs and skips templates', () => {
  const resources: ProxmoxClusterResource[] = [
    {
      type: 'lxc',
      node: 'pve',
      vmid: 102,
      name: 'pihole',
      status: 'running',
      cpu: 0.042,
      maxcpu: 2,
      mem: 256 * 1024 * 1024,
      maxmem: 1024 * 1024 * 1024,
      disk: 2 * 1024 * 1024 * 1024,
      maxdisk: 8 * 1024 * 1024 * 1024,
    },
    {
      type: 'qemu',
      node: 'pve',
      vmid: 200,
      name: 'dokploy-vm',
      status: 'running',
      cpu: 0.256,
      maxcpu: 4,
      mem: 4 * 1024 * 1024 * 1024,
      maxmem: 8 * 1024 * 1024 * 1024,
      disk: 0,
      maxdisk: 64 * 1024 * 1024 * 1024,
    },
    {
      type: 'qemu',
      node: 'pve',
      vmid: 900,
      name: 'ubuntu-template',
      status: 'stopped',
      template: 1,
    },
    {
      type: 'node',
      node: 'pve',
      status: 'online',
      cpu: 0.148,
      maxcpu: 8,
      mem: 12 * 1024 * 1024 * 1024,
      maxmem: 32 * 1024 * 1024 * 1024,
      disk: 40 * 1024 * 1024 * 1024,
      maxdisk: 200 * 1024 * 1024 * 1024,
    },
    {
      type: 'storage',
      node: 'pve',
      name: 'local-lvm',
      status: 'available',
    },
  ]

  const nodes = mapProxmoxResourcesToNodes(resources)

  assert.equal(nodes.length, 3)
  assert.deepEqual(
    nodes.map((node) => ({ id: node.id, kind: node.kind, name: node.name })),
    [
      { id: 'node:pve', kind: 'host', name: 'pve' },
      { id: 'qemu:200', kind: 'vm', name: 'dokploy-vm' },
      { id: 'lxc:102', kind: 'lxc', name: 'pihole' },
    ],
  )

  const host = nodes[0]
  assert.equal(host.metrics.find((m) => m.key === 'cpu')?.value, 15)
  assert.equal(host.metrics.find((m) => m.key === 'ram')?.value, 38)
  assert.equal(host.metrics.find((m) => m.key === 'storage')?.value, 20)

  const vm = nodes[1]
  assert.equal(vm.metrics.find((m) => m.key === 'cpu')?.value, 26)
  assert.equal(vm.metrics.find((m) => m.key === 'ram')?.value, 50)
  const vmDisk = vm.metrics.find((m) => m.key === 'storage')
  assert.equal(vmDisk?.value, null)
  assert.equal(vmDisk?.state, 'empty')
  assert.equal(vmDisk?.detail, '64 GB alloc')

  const lxc = nodes[2]
  assert.equal(lxc.metrics.find((m) => m.key === 'cpu')?.value, 4)
  assert.equal(lxc.metrics.find((m) => m.key === 'ram')?.value, 25)
  assert.equal(lxc.metrics.find((m) => m.key === 'storage')?.value, 25)
})

test('mapProxmoxResourcesToNodes respects optional node filter', () => {
  const resources: ProxmoxClusterResource[] = [
    { type: 'node', node: 'pve-1', status: 'online', cpu: 0.1, maxcpu: 4, mem: 1e9, maxmem: 4e9, disk: 1e9, maxdisk: 10e9 },
    { type: 'node', node: 'pve-2', status: 'online', cpu: 0.2, maxcpu: 4, mem: 2e9, maxmem: 4e9, disk: 2e9, maxdisk: 10e9 },
    { type: 'lxc', node: 'pve-2', vmid: 105, name: 'dns', status: 'running', cpu: 0.05, maxcpu: 1, mem: 1e8, maxmem: 5e8, disk: 1e8, maxdisk: 2e9 },
  ]

  const filtered = mapProxmoxResourcesToNodes(resources, 'pve-2')
  assert.deepEqual(filtered.map((n) => n.id), ['node:pve-2', 'lxc:105'])
})
