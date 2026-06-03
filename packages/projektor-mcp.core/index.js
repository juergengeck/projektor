const OPERATION_TOOL_PREFIX = "operation:";

export function createCanonicalOperationToolName(operation, method) {
  return `${OPERATION_TOOL_PREFIX}${operation}:${method}`;
}

export function parseCanonicalOperationToolName(toolName) {
  const match = /^operation:([^:]+):([^:]+)$/.exec(String(toolName || "").trim());
  if (!match) return null;
  return { operation: match[1], method: match[2] };
}

export function listCanonicalOperationTools(registry) {
  return registry.getAllMetadata()
    .filter((operation) => operation.name !== "mcp")
    .flatMap((operation) => operation.methods.map((method) => ({
      name: createCanonicalOperationToolName(operation.name, method.name),
      operation: operation.name,
      method: method.name,
      description: method.description || `${operation.name}.${method.name}`,
      inputSchema: method.inputSchema || paramsToSchema(method.params || []),
      returns: method.returns || "",
    })));
}

export class ProjektorMcpSupplyManager {
  constructor({ providerPersonId = "projektor.local", now = () => Date.now(), sendCredential } = {}) {
    this.providerPersonId = providerPersonId;
    this.now = now;
    this.sendCredential = sendCredential || (async () => {});
    this.supplies = new Map();
    this.credentials = new Map();
  }

  createSupply({ topicId, allowedTools = [] }) {
    requireString(topicId, "topicId");
    const supply = {
      $type$: "MCPSupply",
      topicId,
      providerPersonId: this.providerPersonId,
      allowedTools: normalizeToolList(allowedTools),
      createdAt: this.now(),
    };
    this.supplies.set(topicId, supply);
    return supply;
  }

  removeSupply({ topicId }) {
    requireString(topicId, "topicId");
    this.supplies.delete(topicId);
    for (const key of this.credentials.keys()) {
      if (key.startsWith(`${topicId}:`)) this.credentials.delete(key);
    }
    return { removed: true };
  }

  hasSupply({ topicId }) {
    requireString(topicId, "topicId");
    return this.supplies.has(topicId);
  }

  getSupply({ topicId }) {
    requireString(topicId, "topicId");
    return this.supplies.get(topicId) || null;
  }

  listSupplies() {
    return [...this.supplies.values()];
  }

  async handleDemand({ topicId, requesterPersonId }) {
    requireString(topicId, "topicId");
    requireString(requesterPersonId, "requesterPersonId");
    const supply = this.supplies.get(topicId);
    if (!supply) {
      return { accepted: false, reason: "No MCP supply is offered for this topic." };
    }

    const key = credentialKey(topicId, requesterPersonId);
    const existing = this.credentials.get(key);
    if (existing && !existing.revokedAt) {
      return { accepted: true, credential: existing, reused: true };
    }

    const credential = {
      $type$: "MCPCredential",
      topicId,
      providerPersonId: this.providerPersonId,
      consumerPersonId: requesterPersonId,
      allowedTools: supply.allowedTools,
      issuedAt: this.now(),
    };
    this.credentials.set(key, credential);
    await this.sendCredential(requesterPersonId, credential);
    return { accepted: true, credential, reused: false };
  }

  hasValidCredential({ topicId, consumerPersonId, toolName }) {
    requireString(topicId, "topicId");
    requireString(consumerPersonId, "consumerPersonId");
    const credential = this.credentials.get(credentialKey(topicId, consumerPersonId));
    if (!credential || credential.revokedAt) return false;
    if (!toolName || credential.allowedTools.length === 0) return true;
    return credential.allowedTools.includes(toolName);
  }

  async revokeCredential({ topicId, consumerPersonId }) {
    requireString(topicId, "topicId");
    requireString(consumerPersonId, "consumerPersonId");
    const key = credentialKey(topicId, consumerPersonId);
    const current = this.credentials.get(key);
    const revoked = {
      ...(current || {
        $type$: "MCPCredential",
        topicId,
        providerPersonId: this.providerPersonId,
        consumerPersonId,
        allowedTools: [],
        issuedAt: 0,
      }),
      revokedAt: this.now(),
    };
    this.credentials.set(key, revoked);
    await this.sendCredential(consumerPersonId, revoked);
    return revoked;
  }

  listCredentials() {
    return [...this.credentials.values()];
  }
}

export class ProjektorMcpServicePlan {
  constructor({ registry, providerPersonId, now, sendCredential } = {}) {
    if (!registry) throw new Error("registry is required");
    this.registry = registry;
    this.now = now || (() => Date.now());
    this.supplyManager = new ProjektorMcpSupplyManager({
      providerPersonId,
      now: this.now,
      sendCredential,
    });
    this.topicConfigs = new Map();
    this.auditLog = [];
  }

  getStatus() {
    const tools = this.getAvailableTools();
    return {
      running: true,
      service: "projektor.mcp",
      toolCount: tools.length,
      availableTools: tools.map((tool) => tool.name),
      supplies: this.supplyManager.listSupplies(),
      credentialCount: this.supplyManager.listCredentials().filter((credential) => !credential.revokedAt).length,
    };
  }

  getAvailableTools() {
    return listCanonicalOperationTools(this.registry);
  }

  getTopicConfig({ topicId }) {
    requireString(topicId, "topicId");
    return this.topicConfigs.get(topicId) || {
      topicId,
      inboundEnabled: false,
      outboundEnabled: false,
      allowedTools: [],
    };
  }

  setTopicConfig({ topicId, config = {} }) {
    requireString(topicId, "topicId");
    const topicConfig = {
      $type$: "MCPTopicConfig",
      topicId,
      inboundEnabled: Boolean(config.inboundEnabled),
      outboundEnabled: Boolean(config.outboundEnabled),
      allowedTools: normalizeToolList(config.allowedTools),
      createdAt: this.topicConfigs.get(topicId)?.createdAt || this.now(),
      updatedAt: this.now(),
    };
    this.topicConfigs.set(topicId, topicConfig);
    if (topicConfig.outboundEnabled) {
      this.supplyManager.createSupply({ topicId, allowedTools: topicConfig.allowedTools });
    } else if (this.supplyManager.hasSupply({ topicId })) {
      this.supplyManager.removeSupply({ topicId });
    }
    return topicConfig;
  }

  createSupply(params) {
    const supply = this.supplyManager.createSupply(params || {});
    const current = this.getTopicConfig({ topicId: supply.topicId });
    this.topicConfigs.set(supply.topicId, {
      ...current,
      $type$: "MCPTopicConfig",
      outboundEnabled: true,
      allowedTools: supply.allowedTools,
      updatedAt: this.now(),
      createdAt: current.createdAt || this.now(),
    });
    return supply;
  }

  removeSupply(params) {
    const result = this.supplyManager.removeSupply(params || {});
    const current = this.getTopicConfig({ topicId: params.topicId });
    this.topicConfigs.set(params.topicId, {
      ...current,
      $type$: "MCPTopicConfig",
      outboundEnabled: false,
      updatedAt: this.now(),
      createdAt: current.createdAt || this.now(),
    });
    return result;
  }

  hasSupply(params) {
    return this.supplyManager.hasSupply(params || {});
  }

  getSupply(params) {
    return this.supplyManager.getSupply(params || {});
  }

  listSupplies() {
    return this.supplyManager.listSupplies();
  }

  handleDemand(params) {
    return this.supplyManager.handleDemand(params || {});
  }

  hasValidCredential(params) {
    return this.supplyManager.hasValidCredential(params || {});
  }

  revokeCredential(params) {
    return this.supplyManager.revokeCredential(params || {});
  }

  async executeTool({ toolName, parameters = {} }) {
    const tool = resolveCanonicalOperationTool(this.registry, toolName);
    if (!tool) throw new Error(`Unknown or non-public MCP tool: ${toolName}`);
    return this.registry.execute(tool.operation, tool.method, parameters);
  }

  async handleRequest({ requestData, senderPersonId, topicId }) {
    requireString(senderPersonId, "senderPersonId");
    requireString(topicId, "topicId");
    const toolCall = normalizeToolCallRequest(requestData);
    if (!this.hasValidCredential({ topicId, consumerPersonId: senderPersonId, toolName: toolCall.toolName })) {
      throw new Error("Sender has no valid MCP credential for this topic/tool.");
    }

    const start = this.now();
    const audit = {
      $type$: "MCPToolCall",
      id: toolCall.id || `mcp-${start}-${Math.random().toString(36).slice(2)}`,
      toolName: toolCall.toolName,
      parameters: JSON.stringify(toolCall.parameters || {}),
      timestamp: start,
      topicId,
      senderPersonId,
    };

    try {
      const result = await this.executeTool({ toolName: toolCall.toolName, parameters: toolCall.parameters || {} });
      const finished = this.now();
      const toolResult = {
        $type$: "MCPToolResult",
        toolCallId: audit.id,
        success: true,
        content: JSON.stringify(result.product ?? result),
        executionTime: finished - start,
      };
      this.auditLog.push({ ...audit, result: toolResult.content, duration: toolResult.executionTime });
      return { $type$: "MCPResponse", toolCallId: audit.id, result: toolResult };
    } catch (error) {
      const finished = this.now();
      const toolResult = {
        $type$: "MCPToolResult",
        toolCallId: audit.id,
        success: false,
        content: "",
        error: error instanceof Error ? error.message : String(error),
        executionTime: finished - start,
      };
      this.auditLog.push({ ...audit, error: toolResult.error, duration: toolResult.executionTime });
      throw error;
    }
  }

  getAuditLog() {
    return [...this.auditLog];
  }

  getToolDefinitions() {
    return [
      {
        name: "getStatus",
        description: "Return Projektor outbound MCP service status, available tools, supplies, and credential count.",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "createSupply",
        description: "Offer Projektor MCP tools to a topic.",
        inputSchema: topicToolListSchema(),
      },
      {
        name: "handleDemand",
        description: "Handle a peer demand for Projektor MCP service access and issue a credential when a supply exists.",
        inputSchema: {
          type: "object",
          properties: {
            topicId: { type: "string" },
            requesterPersonId: { type: "string" },
          },
          required: ["topicId", "requesterPersonId"],
        },
      },
      {
        name: "handleRequest",
        description: "Execute an offered Projektor MCP tool request from a credentialed peer and record an audit entry.",
        inputSchema: {
          type: "object",
          properties: {
            topicId: { type: "string" },
            senderPersonId: { type: "string" },
            requestData: { type: "object" },
          },
          required: ["topicId", "senderPersonId", "requestData"],
        },
      },
    ];
  }
}

export function resolveCanonicalOperationTool(registry, toolName) {
  const parsed = parseCanonicalOperationToolName(toolName);
  if (!parsed) return null;
  const metadata = registry.getAllMetadata().find((operation) => operation.name === parsed.operation);
  if (!metadata || metadata.name === "mcp") return null;
  if (!metadata.methods.some((method) => method.name === parsed.method)) return null;
  return parsed;
}

function normalizeToolCallRequest(requestData) {
  if (!requestData || typeof requestData !== "object") {
    throw new Error("requestData must be an object");
  }
  const toolName = requestData.toolName || requestData.tool || requestData.name;
  requireString(toolName, "requestData.toolName");
  return {
    id: requestData.id,
    toolName,
    parameters: requestData.parameters || requestData.params || {},
  };
}

function topicToolListSchema() {
  return {
    type: "object",
    properties: {
      topicId: { type: "string" },
      allowedTools: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: ["topicId"],
  };
}

function paramsToSchema(params) {
  const properties = {};
  const required = [];
  for (const param of params) {
    properties[param.name] = {
      type: param.type || "string",
      description: param.description || "",
    };
    if (param.required) required.push(param.name);
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

function normalizeToolList(value) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function credentialKey(topicId, personId) {
  return `${topicId}:${personId}`;
}

function requireString(value, name) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required`);
  }
}
