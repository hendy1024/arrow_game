'use strict';
const arrow = (id, path, direction) => ({ id, path, direction });
const level = (arrows, extra = {}) => ({ number: 1, width: 6, height: 6, seed: 1, generatorVersion: 1, profileVersion: 1, lifeLimit: null, arrows, ...extra });
const fixtures = {
    tutorial: level([
        arrow('first', [[1, 1], [2, 1], [3, 1]], 'right'),
        arrow('second', [[1, 4], [2, 4], [2, 3], [2, 2]], 'up'),
        arrow('third', [[4, 3], [4, 4], [4, 5]], 'down')
    ]),
    bent: level([arrow('bend', [[1, 4], [1, 3], [2, 3], [3, 3], [3, 2]], 'up')]),
    blocked: level([arrow('a', [[0, 2], [1, 2]], 'right'), arrow('b', [[4, 3], [4, 2], [4, 1]], 'up')]),
    cycle: level([arrow('a', [[1, 1], [2, 1]], 'right'), arrow('b', [[4, 1], [4, 2]], 'down'), arrow('c', [[4, 4], [3, 4]], 'left'), arrow('d', [[1, 4], [1, 3]], 'up')]),
    selfBlocked: level([arrow('a', [[2, 0], [3, 0], [3, 1], [3, 2], [2, 2], [2, 1]], 'up')]),
    boundary: level([arrow('a', [[4, 0], [5, 0]], 'right')])
};
module.exports = { arrow, level, fixtures };
