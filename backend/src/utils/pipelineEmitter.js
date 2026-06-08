const { EventEmitter } = require('events');

/**
 * PipelineEmitter — central event bus for streaming pipeline progress
 * to the frontend via Server-Sent Events (SSE).
 *
 * Event types:
 *   stage:start    { stage, label }
 *   stage:progress { stage, message, data? }
 *   stage:complete { stage, count, data? }
 *   stage:error    { stage, message }
 *   pipeline:checkpoint { contacts }   ← safety gate before sending emails
 *   pipeline:complete   { summary }
 *   pipeline:error      { message }
 *   log            { level, message }
 */
class PipelineEmitter extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  stageStart(stage, label) {
    this.emit('event', { type: 'stage:start', stage, label, ts: Date.now() });
  }

  stageProgress(stage, message, data = null) {
    this.emit('event', { type: 'stage:progress', stage, message, data, ts: Date.now() });
  }

  stageComplete(stage, count, data = null) {
    this.emit('event', { type: 'stage:complete', stage, count, data, ts: Date.now() });
  }

  stageError(stage, message, detail = null) {
    this.emit('event', { type: 'stage:error', stage, message, detail, ts: Date.now() });
  }

  checkpoint(contacts) {
    this.emit('event', { type: 'pipeline:checkpoint', contacts, ts: Date.now() });
  }

  pipelineComplete(summary) {
    this.emit('event', { type: 'pipeline:complete', summary, ts: Date.now() });
  }

  pipelineError(message) {
    this.emit('event', { type: 'pipeline:error', message, ts: Date.now() });
  }

  log(level, message) {
    this.emit('event', { type: 'log', level, message, ts: Date.now() });
  }
}

module.exports = new PipelineEmitter();
