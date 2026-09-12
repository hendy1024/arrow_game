'use strict';
const { validateLevel, clone, occupancy, firstBlocker, exitCells, key } = require('./board');
const { bodyAt, completionDistance, occupiedByBody } = require('../movement/path');
const { CONFIG } = require('../config');
class Session {
    constructor(level) {
        const result = validateLevel(level);
        if (!result.valid)
            throw new Error('Invalid level: ' + result.errors.join(','));
        this.level = clone(level);
        this.removed = new Set();
        this.moves = new Map();
        this.feedback = new Map();
        this.lives = level.lifeLimit;
        this.state = 'playing';
        this.time = 0;
        this.events = [];
        this.remainingMs = level.timeLimitMs ?? null;
        this.failureReason = null;
    }
    get remaining() { return this.level.arrows.length - this.removed.size; }
    emit(type, data = {}) { this.events.push({ type, ...data }); }
    drainEvents() { const events = this.events; this.events = []; return events; }
    classify(id) {
        if (this.state !== 'playing')
            return { type: 'locked' };
        if (!id || this.removed.has(id))
            return { type: 'empty' };
        const arrow = this.level.arrows.find(a => a.id === id);
        if (!arrow)
            return { type: 'empty' };
        if (this.moves.has(id))
            return { type: 'moving' };
        if ((this.feedback.get(id)?.until || 0) > this.time)
            return { type: 'feedback' };
        const excluded = new Set([...this.removed, ...this.moves.keys()]);
        const occupied = occupancy(this.level, excluded);
        for (const [movingId, move] of this.moves) {
            const movingArrow = this.level.arrows.find(a => a.id === movingId);
            for (const cell of occupiedByBody(movingArrow, move.distance, this.level))
                occupied.set(cell, movingId);
        }
        const blocker = firstBlocker(arrow, this.level, occupied);
        if (blocker)
            return { type: this.moves.has(blocker.id) ? 'temporary' : 'blocked', blocker, arrow };
        const ray = new Set(exitCells(arrow, this.level).map(key));
        for (const movingId of this.moves.keys()) {
            const other = this.level.arrows.find(a => a.id === movingId);
            if (exitCells(other, this.level).some(p => ray.has(key(p))))
                return { type: 'temporary', arrow };
        }
        return { type: 'allowed', arrow };
    }
    click(id) {
        const result = this.classify(id);
        if (result.type === 'blocked') {
            if (this.lives !== null)
                this.lives--;
            this.feedback.set(id, { until: this.time + CONFIG.feedbackMs, blocker: result.blocker });
            this.emit('blocked', { id, blocker: result.blocker, lives: this.lives });
            if (this.lives === 0) {
                this.state = 'failed';
                this.failureReason = 'lives';
                this.emit('failed');
            }
        }
        else if (result.type === 'allowed') {
            this.moves.set(id, { id, distance: 0, elapsedMs: 0 });
            this.emit('move-start', { id });
        }
        return result;
    }
    complete(id) {
        if (!this.moves.has(id) || this.removed.has(id))
            return false;
        this.moves.delete(id);
        this.removed.add(id);
        this.emit('removed', { id, remaining: this.remaining });
        if (this.remaining === 0 && this.state !== 'failed' && this.state !== 'won') {
            this.state = 'won';
            this.emit('won');
        }
        return true;
    }
    tick(ms) {
        if (this.state === 'paused')
            return;
        if (!Number.isFinite(ms) || ms < 0)
            throw new Error('Invalid elapsed time');
        if (this.state === 'playing' && this.remainingMs !== null) {
            if (this.moves.size === this.remaining && this.remaining > 0) {
                const finish = Math.max(...[...this.moves].map(([id, move]) => Math.max(0, completionDistance(this.level.arrows.find(a => a.id === id), this.level) * 1000 / CONFIG.speed - move.elapsedMs)));
                if (finish < this.remainingMs && finish <= ms) ms = finish;
            }
            const elapsed = Math.min(ms, this.remainingMs);
            this.remainingMs -= elapsed;
            ms = elapsed;
            if (this.remainingMs === 0) { this.state = 'failed'; this.failureReason = 'timeout'; this.emit('failed', { reason: 'timeout' }); }
        }
        this.time += ms;
        for (const [id, f] of this.feedback)
            if (f.until <= this.time)
                this.feedback.delete(id);
        for (const [id, move] of this.moves) {
            const arrow = this.level.arrows.find(a => a.id === id);
            move.elapsedMs += ms;
            move.distance = move.elapsedMs * CONFIG.speed / 1000;
            if (move.distance >= completionDistance(arrow, this.level))
                this.complete(id);
        }
    }
    paths() { const result = new Map(); for (const [id, m] of this.moves)
        result.set(id, bodyAt(this.level.arrows.find(a => a.id === id), m.distance)); return result; }
    pause() { if (this.state === 'playing') {
        this.state = 'paused';
        return true;
    } return false; }
    resume() { if (this.state === 'paused')
        this.state = 'playing'; }
    restart() { return new Session(this.level); }
}
module.exports = { Session };
