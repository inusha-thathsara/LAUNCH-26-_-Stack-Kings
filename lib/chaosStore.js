export const chaosState = {
  deadNodes: [],
  deadLinks: [],
};

export function killNode(nodeId) {
  if (!chaosState.deadNodes.includes(nodeId)) {
    chaosState.deadNodes.push(nodeId);
  }
}

export function killLink(from, to) {
  const key = `${from}-${to}`;

  if (!chaosState.deadLinks.includes(key)) {
    chaosState.deadLinks.push(key);
  }
}

export function restoreAll() {
  chaosState.deadNodes = [];
  chaosState.deadLinks = [];
}