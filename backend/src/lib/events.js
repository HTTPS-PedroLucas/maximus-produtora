// Barramento de eventos em memória usado pelo endpoint SSE (/api/events).
// Cada aba aberta da equipe mantém uma conexão e recebe as alterações
// feitas pelos outros usuários do mesmo workspace.

const clients = new Set();
let nextId = 1;

function subscribe(res, workspaceId) {
  const client = { id: nextId++, res, workspaceId: Number(workspaceId) };
  clients.add(client);
  return () => clients.delete(client);
}

/**
 * Publica um evento para todos os usuários conectados do workspace.
 * @param {number} workspaceId
 * @param {string} type  clients | team | captures | videos | activity
 * @param {object} payload  dados mínimos para o cliente decidir o que recarregar
 */
function publish(workspaceId, type, payload = {}) {
  const message = `event: change\ndata: ${JSON.stringify({ type, ...payload, at: new Date().toISOString() })}\n\n`;
  for (const client of clients) {
    if (client.workspaceId !== Number(workspaceId)) continue;
    try {
      client.res.write(message);
    } catch {
      clients.delete(client);
    }
  }
}

function heartbeat() {
  for (const client of clients) {
    try {
      client.res.write(': ping\n\n');
    } catch {
      clients.delete(client);
    }
  }
}

function connectionCount() {
  return clients.size;
}

module.exports = { subscribe, publish, heartbeat, connectionCount };
