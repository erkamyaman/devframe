import type { McpAuthorization } from './devframe'

/**
 * The MCP adapter surface, typed here so `devframe` (which probes for and
 * lazily loads `@devframes/agentic`) and `@devframes/agentic/mcp` (which
 * implements it) share one contract without a type-level dependency cycle.
 * None of these shapes reference the MCP SDK: the SDK is an implementation
 * detail of `@devframes/agentic`, freely swappable behind this surface.
 * The h3-bound `mountMcpHttp` shapes live in `node/agentic.ts` (exported via
 * `devframe/internal`) instead: `devframe/types` must stay lib-neutral, and
 * h3's declarations are not.
 */

/** One argument of an {@link McpPrompt}, listed in `prompts/list`. */
export interface McpPromptArgument {
  /** Argument name, the key in the `arguments` of `prompts/get`. */
  name: string
  /** What the argument is for, shown to the user by the MCP client. */
  description?: string
  /**
   * When `true`, `prompts/get` answers an invalid-params error (`DF0083`)
   * if the argument is missing or empty.
   */
  required?: boolean
}

/** One message in the answer of `prompts/get`. */
export interface McpPromptMessage {
  role: 'user' | 'assistant'
  content: { type: 'text', text: string }
}

/** What an {@link McpPrompt} returns from `get`, sent as the `prompts/get` result. */
export interface McpPromptResult {
  description?: string
  messages: McpPromptMessage[]
}

/**
 * A prompt template the MCP server lists in `prompts/list` and fills in
 * `prompts/get`. An MCP client often offers it to the user as a slash
 * command.
 */
export interface McpPrompt {
  /** Unique name of the prompt. When two prompts share a name, the first one wins. */
  name: string
  /** Human-readable name for display. */
  title?: string
  description?: string
  /** The arguments the prompt takes. */
  arguments?: McpPromptArgument[]
  /** Build the messages from the arguments the MCP client sent. */
  get: (args: Record<string, string>) => McpPromptResult | Promise<McpPromptResult>
}

export interface CreateMcpServerOptions {
  /**
   * Transport to use. `createMcpServer` itself runs `'stdio'` (a standalone
   * process with its own host context); the Streamable-HTTP transport is
   * served route-based by the dev server instead; see `mountMcpHttp` and
   * the `mcp` option on `createDevServer` / `createCac`'s `--mcp` flag.
   */
  transport?: 'stdio'
  /**
   * Expose shared-state keys as MCP resources.
   * - `true` (default): every key the host publishes
   * - `false`: none
   * - `(key) => boolean`: filter
   */
  exposeSharedState?: boolean | ((key: string) => boolean)
  /**
   * Prompt templates served through `prompts/list` and `prompts/get`.
   * Omitted or empty declares no `prompts` capability.
   */
  prompts?: McpPrompt[]
  /** Override the name reported in the MCP handshake. */
  serverName?: string
  /** Override the version reported in the MCP handshake. Defaults to `definition.version ?? '0.0.0'`. */
  serverVersion?: string
  /** Called once the transport is connected. */
  onReady?: (info: { transport: 'stdio' }) => void
}

export interface McpServerHandle {
  stop: () => Promise<void>
}

export interface CreateMcpFetchHandlerOptions {
  /** Name reported in the MCP handshake. */
  serverName: string
  /** Version reported in the MCP handshake. */
  serverVersion: string
  /** Expose shared-state keys as MCP resources; see {@link CreateMcpServerOptions.exposeSharedState}. */
  exposeSharedState: boolean | ((key: string) => boolean)
  /** Prompt templates; see {@link CreateMcpServerOptions.prompts}. */
  prompts?: McpPrompt[]
  /**
   * Optional identity check, layered on top of the origin gate and checked
   * **after** it: a bearer token string (matched in constant time against
   * `Authorization: Bearer <token>`), a `(request) => boolean` callback, or
   * `false` (the default) for origin-only, trusting same-machine callers. A
   * callback governs identity only and cannot relax the origin gate. See
   * {@link McpAuthorization}.
   */
  authorization?: McpAuthorization
  /**
   * Origin allow-list beyond the loopback default. `false` disables the
   * origin gate entirely. Default: loopback-only.
   *
   * Unlike the WS transport, the MCP route does **not** allow `Origin`-less
   * requests: a route-based endpoint is reachable by any local process, so a
   * request must carry an `Origin` that passes the gate. Native clients
   * (e.g. `devframe connect`) send their loopback origin explicitly.
   */
  allowedOrigins?: readonly string[] | false
}

/** Connection facts a host knows about a request beyond the `Request` itself. */
export interface McpConnectionInfo {
  /**
   * The connecting peer's remote address (a node socket's `remoteAddress`),
   * used to prove a same-machine caller when the endpoint relies on the
   * loopback origin default with no identity check. A host that can resolve a
   * trustworthy peer address (the h3/node mount) supplies it; when it's
   * omitted the origin gate stays the only locality signal.
   */
  remoteAddress?: string
}

export interface McpFetchHandler {
  /**
   * WHATWG-`fetch` handler for the MCP endpoint. Hand every method
   * (POST/GET/DELETE) on the endpoint's path to it; routing by path is the
   * host's job. Pass {@link McpConnectionInfo} when the host can resolve the
   * peer address so the default trust boundary can enforce same-machine
   * locality.
   */
  fetch: (request: Request, connection?: McpConnectionInfo) => Promise<Response>
  /** Tear down the handler (aborts in-flight exchanges, drops the change bridge). */
  dispose: () => Promise<void>
}
