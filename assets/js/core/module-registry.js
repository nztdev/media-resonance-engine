/**
 * MEDIA RESONANCE ENGINE · module-registry.js
 * ─────────────────────────────────────────────
 * Ecosystem plugin registration and activation system.
 * ZERO DOM DEPENDENCIES.
 * React Native portable — copy to packages/core unchanged.
 *
 * Usage:
 *   ModuleRegistry.register(moduleDefinition)
 *   ModuleRegistry.activate('im-tuned')
 *   ModuleRegistry.get('im-tuned')
 *   ModuleRegistry.list()
 *
 * v0.3 · https://github.com/[your-username]/media-resonance-engine
 */

const ModuleRegistry = (() => {

  // ── Internal registry store ────────────────────────────────
  const _modules = new Map();

  // ── Module status constants ────────────────────────────────
  const STATUS = {
    LIVE:      'live',
    BETA:      'beta',
    COMING:    'coming-soon',
    PLANNED:   'planned',
    DISABLED:  'disabled',
  };

  // ── Module definition schema ───────────────────────────────
  /**
   * @typedef {object} ModuleDefinition
   * @property {string}   id          — unique slug e.g. 'im-tuned'
   * @property {string}   name        — display name
   * @property {string}   description — short description
   * @property {string}   status      — from STATUS constants
   * @property {string[]} mediaTypes  — supported media type ids
   * @property {string}   version     — semver string
   * @property {object}   [config]    — module-specific config
   * @property {Function} [process]   — main processing function (pure, no DOM)
   * @property {Function} [analyse]   — analysis function (pure, no DOM)
   */

  /**
   * Register a module with the registry.
   * @param {ModuleDefinition} definition
   * @throws {Error} if id is missing or already registered
   */
  function register(definition) {
    if (!definition || !definition.id) {
      throw new Error('ModuleRegistry: module definition must have an id');
    }
    if (_modules.has(definition.id)) {
      console.warn(`ModuleRegistry: module "${definition.id}" is already registered — overwriting`);
    }

    _modules.set(definition.id, {
      ...definition,
      registeredAt: Date.now(),
      active: definition.status === STATUS.LIVE || definition.status === STATUS.BETA,
    });
  }

  /**
   * Activate a registered module.
   * @param {string} id
   */
  function activate(id) {
    const mod = _modules.get(id);
    if (!mod) throw new Error(`ModuleRegistry: module "${id}" not found`);
    _modules.set(id, { ...mod, active: true });
  }

  /**
   * Deactivate a module.
   * @param {string} id
   */
  function deactivate(id) {
    const mod = _modules.get(id);
    if (!mod) throw new Error(`ModuleRegistry: module "${id}" not found`);
    _modules.set(id, { ...mod, active: false });
  }

  /**
   * Get a module by id.
   * @param {string} id
   * @returns {ModuleDefinition|undefined}
   */
  function get(id) {
    return _modules.get(id);
  }

  /**
   * List all registered modules.
   * @param {object} [filter]
   * @param {string} [filter.status]    — filter by status
   * @param {boolean} [filter.active]   — filter by active state
   * @param {string} [filter.mediaType] — filter by supported media type
   * @returns {ModuleDefinition[]}
   */
  function list(filter = {}) {
    const all = Array.from(_modules.values());

    return all.filter(mod => {
      if (filter.status    !== undefined && mod.status !== filter.status)         return false;
      if (filter.active    !== undefined && mod.active !== filter.active)         return false;
      if (filter.mediaType !== undefined && !mod.mediaTypes.includes(filter.mediaType)) return false;
      return true;
    });
  }

  /**
   * Check if a module is registered and active.
   * @param {string} id
   * @returns {boolean}
   */
  function isActive(id) {
    const mod = _modules.get(id);
    return mod ? mod.active : false;
  }

  /**
   * Process media through a module.
   * Delegates to the module's process() function if it exists.
   * @param {string} moduleId
   * @param {object} input     — media data (pure — no DOM objects)
   * @param {object} options   — processing options
   * @returns {Promise<object>} result
   */
  async function process(moduleId, input, options = {}) {
    const mod = _modules.get(moduleId);
    if (!mod)        throw new Error(`ModuleRegistry: module "${moduleId}" not found`);
    if (!mod.active) throw new Error(`ModuleRegistry: module "${moduleId}" is not active`);
    if (!mod.process) throw new Error(`ModuleRegistry: module "${moduleId}" has no process() function`);

    return mod.process(input, options);
  }

  // ── Register built-in modules ──────────────────────────────
  // These are registered at startup. The process() functions
  // are implemented fully in v0.6+. Stubs provided for architecture.

  register({
    id: 'im-tuned',
    name: "I'm Tuned!",
    description: 'Universal frequency alignment for any media type',
    status: STATUS.LIVE,
    mediaTypes: ['audio', 'video', 'image', 'text', 'pdf'],
    version: '0.3.0',
    config: {
      defaultHz: 432,
      defaultIntensity: 72,
    },
    process: async (input, options) => {
      // Full implementation in v0.6 — frequency-engine.js
      return { status: 'pending', message: 'Engine being built in v0.6' };
    },
    analyse: async (input, options) => {
      // Full implementation in v0.5 — resonance-analyser.js
      return { status: 'pending', message: 'Analyser being built in v0.5' };
    },
  });

  register({
    id: 'frame-resonance',
    name: 'Frame Resonance',
    description: 'Frequency alignment for video — colour, sound, and narrative',
    status: STATUS.COMING,
    mediaTypes: ['video'],
    version: '0.0.0',
    config: {},
  });

  register({
    id: 'script-alignment',
    name: 'Script Alignment',
    description: 'Resonance analysis and restructuring for written content',
    status: STATUS.COMING,
    mediaTypes: ['text', 'pdf'],
    version: '0.0.0',
    config: {},
  });

  register({
    id: 'live-stream-tuner',
    name: 'Live Stream Tuner',
    description: 'Real-time frequency alignment for live audio and video streams',
    status: STATUS.PLANNED,
    mediaTypes: ['stream'],
    version: '0.0.0',
    config: {},
  });

  register({
    id: 'brand-resonance',
    name: 'Brand Resonance',
    description: 'Map and align the complete frequency signature of your brand assets',
    status: STATUS.PLANNED,
    mediaTypes: ['image', 'text', 'audio'],
    version: '0.0.0',
    config: {},
  });

  register({
    id: 'resonance-api',
    name: 'Resonance API',
    description: 'Developer API for integrating frequency alignment into any pipeline',
    status: STATUS.PLANNED,
    mediaTypes: ['audio', 'video', 'image', 'text'],
    version: '0.0.0',
    config: {},
  });

  // ── Public API ─────────────────────────────────────────────
  return {
    STATUS,
    register,
    activate,
    deactivate,
    get,
    list,
    isActive,
    process,
  };

})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModuleRegistry;
}
