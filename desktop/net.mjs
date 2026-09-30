/**
 * Which of this computer's addresses phones and laptops on the same Wi-Fi or
 * office network can actually reach (`bugstow start --lan`).
 *
 * Windows with WSL, Hyper-V, Docker or VirtualBox has several virtual
 * adapters with private 172.x addresses that nothing else on the network can
 * reach; picking the first private address used to print one of those.
 */

const VIRTUAL = /vethernet|wsl|hyper-?v|virtualbox|vbox|vmware|vmnet|docker|br-|veth|virbr|tailscale|zerotier|utun|tun\d|tap\d|loopback|bluetooth/i

/** Lower is better: home and office networks are nearly always 192.168.x or 10.x. */
function rank(ip) {
  if (ip.startsWith('192.168.')) return 0
  if (ip.startsWith('10.')) return 1
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return 2
  return 9
}

/**
 * @param {Record<string, Array<{family: string|number, address: string, internal: boolean}> | undefined>} interfaces
 *   os.networkInterfaces()
 * @returns {string|null}
 */
export function pickLanAddress(interfaces) {
  const found = []
  for (const [name, list] of Object.entries(interfaces)) {
    for (const a of list || []) {
      const v4 = a.family === 'IPv4' || a.family === 4
      if (!v4 || a.internal) continue
      found.push({ ip: a.address, virtual: VIRTUAL.test(name), rank: rank(a.address) })
    }
  }
  found.sort((x, y) => Number(x.virtual) - Number(y.virtual) || x.rank - y.rank)
  const best = found[0]
  // Only private addresses; a virtual adapter only if there is nothing else.
  return best && best.rank < 9 ? best.ip : null
}
