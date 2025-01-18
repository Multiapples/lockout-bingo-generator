import { Canvas } from "canvas";
import { data } from "./objectives/example.js";
import fs from "node:fs";

/** @type {{ name: string, types: string[] }[][]} */
const bingo_data = data;

function expect(predicate, msg = null) {
    if (predicate) {
        return;
    }
    if (msg) {
        throw new Error(msg);
    } else {
        throw new Error();
    }
}

class Objective {
    /**
     * @param {number} tier
     * @param {string} name
     * @param {string[]} types
     */
    constructor(tier, name, types) {
        expect(tier !== undefined, "tier is undefined");
        expect(name !== undefined, "name is undefined");
        expect(types !== undefined, "types is undefined");
        this.tier = tier;
        this.name = name;
        this.types = types;
        this.types_set = new Set(types);
    }

    /**
     * Returns true if this objective contains all given types
     * @param {string[]} types
     * @returns {boolean}
     */
    includes_types(types) {
        return types.every(t => this.types_set.has(t))
    }

    /**
     * Returns true if this objective contains none of the given types
     * @param {string[]} types
     * @returns {boolean}
     */
    excludes_types(types) {
        return types.every(t => !this.types_set.has(t));
    }
}

const bingo_pool = bingo_data.flatMap((tier_pool, tier) =>
    tier_pool.map(obj => {
        expect(obj.types);
        return new Objective(tier, obj.name, obj.types)
    })
);
const MIN_TIER = bingo_pool.reduce((acc, obj) => Math.min(acc, obj.tier), Number.MAX_SAFE_INTEGER);
const MAX_TIER = bingo_pool.reduce((acc, obj) => Math.max(acc, obj.tier), -1);

function print_all_objectives() {
    for (const obj of bingo_pool) {
        console.log(obj.tier + ": " + obj.name
            + " [" + obj.types.join(", ") + "]");
    }
}
// print_all_objectives();

/**
 * Represents an inclusive-inclusive interval of floating point numbers.
 */
class Interval {
    /**
     * @param {number} min
     * @param {number} max
     */
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }

    /**
     * @return {Interval} A new interval representing the same range.
     */
    clone() {
        return new Interval(this.min, this.max);
    }

    /**
     * @return {number} An integer within {@link min} inclusive and {@link max} inclusive.
     *      Returns {@link orElse} if {@link min} is greater than {@link max}.
     */
    randomInt(orElse) {
        if (this.min > this.max) {
            return orElse;
        }
        return Math.floor((Math.random() * (this.max + 1 - this.min))) % (this.max + 1 - this.min);
    }

    /**
     * @return {boolean} If value is an element of this interval.
     */
    contains(value) {
        return value >= this.min && value <= this.max;
    }

    /**
     * @param {number} x
     * @return {Interval} this
     */
    addValue(x) {
        this.min += x;
        this.max += x;
        return this;
    }

    /**
     * @param {Interval} other
     * @return {Interval} this
     */
    add(other) {
        this.min += other.min;
        this.max += other.max;
        return this;
    }

    /**
     * @param {number} x
     * @return {Interval} this
     */
    subValue(x) {
        this.min -= x;
        this.max -= x;
        return this;
    }

    /**
     * @param {Interval} other
     * @return {Interval} this
     */
    sub(other) {
        this.min -= other.max;
        this.max -= other.min;
        return this;
    }

    /**
     * @param {number} x
     * @return {Interval} this
     */
    mulValue(x) {
        if (x > 0) {
            this.min *= x;
            this.max *= x;
        } else {
            const temp = this.min;
            this.min = this.max * x;
            this.max = temp * x;
        }
        return this;
    }

    /**
     * @param {Interval} a
     * @param {Interval} b
     * @return {Interval} The intersection of `a` and `b`.
     */
    static intersection(a, b) {
        return new Interval(
            Math.max(a.min, b.min),
            Math.min(a.max, b.max)
        );
    }

    /**
     * @return {Interval} A new Interval with the range of safe integers.
     */
    static safeIntegerRange() {
        return new Interval(Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    }
    
    /**
     * @returns {Intervasl} A new Interval with the range of [value, value].
     */
    static valueOf(value) {
        return new Interval(value, value);
    }
}

/**
 * Picks a random bingo objective with the given parameters.
 * @param {TypeExclusivity} type_exclusivity
 * @param {Interval} tier_interval
 * @param {string[][]} exclude_types
 * @param {Set<string>} exclude_names
 * @returns {Objective[]}
 */
function narrow_bingo_pool(type_exclusivity, tier_interval, exclude_types, exclude_names) {
    switch (type_exclusivity) {
        case "none":
            return bingo_pool.filter(obj =>
                tier_interval.contains(obj.tier) &&
                !exclude_names.has(obj.name)
            );
        case "partial":
            return bingo_pool.filter(obj =>
                tier_interval.contains(obj.tier) &&
                !exclude_names.has(obj.name) &&
                exclude_types.every(v => !obj.includes_types(v))
            );
        case "strict":
            const exclude_set = new Set();
            exclude_types.forEach(types => exclude_set.add(...types));
            return bingo_pool.filter(obj =>
                tier_interval.contains(obj.tier) &&
                !exclude_names.has(obj.name) &&
                exclude_types.every(v => obj.excludes_types(v))
            );
        default:
            throw new Error("Unhandled switch case: " + type_exclusivity);
    }
}

/**
 * @typedef {"strict" | "partial" | "none"} TypeExclusivity
 */
/**
 * @typedef {Object} GeneratorContext
 * @property {Objective[][]} board
 * @property {number} size
 * @property {Interval} objective_difficulty The acceptable interval for the tier of each individual objective.
 * @property {Interval} bingo_difficulty The acceptable interval for the sum of tiers on each bingo line.
 * @property {TypeExclusivity} type_exclusivity The strictness of type-incompatibility in bingo lines
 * @property {Set<string>} objective_names The names of all objectives currently on the board.
 * @property {number} depth The number of filled cells.
 * @property {number} depth_record The greatest depth reached.
 * @property {number} backtracks The number of backtracks.
 */

/**
 * Generates a bingo board by modifying a `size`x`size` board in place.
 * @param {GeneratorContext} context
 * @param {number} row The row to check constraints for
 * @param {number} col The col to check constraints for
 * @returns {{
 *      tier_interval: Interval,
 *      exclude_types: string[][],
 * }}
 */
function count_bingo_constraints(context, row, col) {
    const { board, size, objective_difficulty, bingo_difficulty } = context;
    // Pick a random objective that works
    // Count tiers already present in each bingo to narrow down acceptable tiers.
    // Also count types already present in each bingo to narrow down acceptable types.
    /** @type {Interval[]} */
    let bingo_tier_intervals = new Array(4).fill(0).map(_ => bingo_difficulty.clone());
    /** @type {string[][]} */
    let bingo_types = [];
    for (let i = 0; i < size; i++) { // Along row
        if (i === col) {
            continue;
        }
        /** @type {Objective | null} */
        const cell = board[row][i];
        bingo_tier_intervals[0].sub(cell === null ? objective_difficulty : Interval.valueOf(cell.tier));
        if (cell !== null) {
            bingo_types.push(cell.types);
        }
    }

    for (let i = 0; i < size; i++) { // Along col
        if (i === row) {
            continue;
        }
        /** @type {Objective | null} */
        const cell = board[i][col];
        bingo_tier_intervals[1].sub(cell === null ? objective_difficulty : Interval.valueOf(cell.tier));
        if (cell !== null) {
            bingo_types.push(cell.types);
        }
    }

    if (row === col) {
        for (let i = 0; i < size; i++) { // Along \ diagonal
            if (i === row) {
                continue;
            }
            /** @type {Objective | null} */
            const cell = board[i][i];
            bingo_tier_intervals[2].sub(cell === null ? objective_difficulty : Interval.valueOf(cell.tier));
            if (cell !== null) {
                bingo_types.push(cell.types);
            }
        }
    } else {
        bingo_tier_intervals[2] = null;
    }

    if (row + col === size - 1) {
        for (let i = 0; i < size; i++) { // Along / diagonal
            if (i === row) {
                continue;
            }
            /** @type {Objective | null} */
            const cell = board[i][size - 1 - i];
            bingo_tier_intervals[3].sub(cell === null ? objective_difficulty : Interval.valueOf(cell.tier));
            if (cell !== null) {
                bingo_types.push(cell.types);
            }
        }
    } else {
        bingo_tier_intervals[3] = null;
    }
    
    const bingo_tier_interval = bingo_tier_intervals.filter(v => v !== null)
        .reduce(
            (acc, itv) => Interval.intersection(acc, itv),
            objective_difficulty
        );

    return {
        tier_interval: bingo_tier_interval,
        exclude_types: bingo_types,
    };
}

/**
 * @param {Array} array 
 */
function shuffle_array(array) {
    for (var i = array.length - 1; i >= 0; i--) {
        var j = Math.floor(Math.random() * (i + 1)) % (i + 1);
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
}

/**
 * Generates a bingo board by modifying a `size`x`size` board in place.
 * @param {GeneratorContext} context
 * @returns {boolean} `true` if the board generated successfully, `false` if a dead end was reached.
 */
function generate_board_helper(context) {
    const { board, size } = context;

    if (context.depth > context.depth_record) {
        context.depth_record = context.depth;
        console.log(`Cell ${context.depth} / ${size * size}`);
    }

    if (context.depth >= size * size) {
        return true; // Done
    }
    const row = Math.floor(context.depth / size);
    const col = context.depth % size;

    const constraints = count_bingo_constraints(context, row, col)
    const pool = narrow_bingo_pool(context.type_exclusivity, constraints.tier_interval, constraints.exclude_types, context.objective_names);
    if (pool.length == 0) {
        // No success found. Backtrack.
        return false;
    }
    shuffle_array(pool);
    
    // Go deeper.
    context.depth++;
    for (const objective of pool) {
        board[row][col] = objective;
        context.objective_names.add(objective.name);
        const result = generate_board_helper(context);
        if (result) {
            return true; // Propagate success.
        } else {
            // Dead end encountered. Pick a different objective.
            context.backtracks++;
            context.objective_names.delete(objective.name);
            // if (context.backtracks % 1_000_000 === 0) {
            //     console.log("backtracks: " + context.backtracks);
            // }
            const BACKTRACK_LIMIT = 100;
            if (context.depth > 5) { // Permute all first 5 cells regardless of backtracking limit.
                if (context.backtracks >= BACKTRACK_LIMIT) {
                    if (context.backtracks === BACKTRACK_LIMIT) {
                        console.log("Too much backtracking... Restarting.");
                    }
                    break;
                }
            } else {
                context.backtracks = 0;
            }
                
            continue;
        }
    }
    // No success found. Backtrack.
    context.depth--;
    board[row][col] = null;
    return false;
}

/**
 * @param {number} size
 * @param {Interval | null} objective_difficulty The range of tiers that objectives will be pulled from.
 *  Pass in null to include all tiers.
 * @param {Interval} bingo_difficulty The acceptable interval for the sum of tiers on each bingo line.
 * @param {TypeExclusivity} type_exclusivity The strictness of type-incompatibility in bingo lines.
 *  -  `none` ignores objective types completely.
 *  -  `partial` avoids putting objectives with completely identical types into the same bingo line.
 *  -  `strict` avoids putting objectives with any shared types into the same bingo line.
 * @returns {Objective[][] | Error} A new `size`x`size` bingo board, or an `Error` objective if none was found.
 */
function generate_board(size, objective_difficulty, bingo_difficulty, type_exclusivity) {
    /** @type {Objective[][]} */
    let board = new Array(size).fill(0).map(_ =>
        new Array(size).fill(null)
    );

    /** @type {GeneratorContext} */
    const context = {
        board: board,
        size: size,
        objective_difficulty: objective_difficulty ?? Interval.safeIntegerRange(),
        bingo_difficulty: bingo_difficulty,
        type_exclusivity: type_exclusivity,
        objective_names: new Set(),
        depth: 0,
        depth_record: 0,
        backtracks: 0,
    };
    const result = generate_board_helper(context);
    if (!result) {
        return Error("Board not found. A board may be possible but simply not found by the generator.");
    }
    return board;
}

/**
 * Adapted and edited from {@link https://stackoverflow.com/a/19894149}
 * @param {CanvasRenderingContext2D} context
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} line_height
 * @param {number} line_width
 * @returns {string[]} The lines of wrapped text.
 */
function wrap_text(context, text, line_width) {
    let lines = [];
    let line = '';
    const paragraphs = text.split('\n');
    for (const paragraph of paragraphs) {
        const words = paragraph.split(' ');
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = context.measureText(testLine.trim());
            const testWidth = metrics.width;
            if (testWidth > line_width && n > 0) {
                lines.push(line.trim());
                line = words[n] + ' ';
            } else {
                line = testLine;
            }
        }
        lines.push(line.trim());
        line = '';
    }
    return lines;
}

/**
 * @param {Objective[][]} board
 */
function save_board_image(board) {
    const size = board.length;
    
    const cell_size = { w: 256, h: 256 };
    const stroke_weight = 15;
    let canvas = new Canvas(
        size * cell_size.w + stroke_weight,
        size * cell_size.h + stroke_weight
    );
    let context = canvas.getContext('2d');
    
    context.fillStyle = "rgb(51,51,51)";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.lineWidth = stroke_weight;
    board.forEach((row, row_idx) => {
        row.forEach((obj, col_idx) => {
            const cell_rect = {
                x: row_idx * cell_size.w + stroke_weight,
                y: col_idx * cell_size.h + stroke_weight,
                w: cell_size.w - stroke_weight,
                h: cell_size.h - stroke_weight,
            };

            context.fillStyle = "rgb(0, 0, 0)";
            context.strokeRect(
                cell_rect.x - stroke_weight / 2,
                cell_rect.y - stroke_weight / 2,
                cell_rect.w + stroke_weight,
                cell_rect.h + stroke_weight
            );

            context.font = "bold 36px sans-serif"
            context.fillStyle = "rgb(255, 255, 255)";
            context.textAlign = "center"
            context.textBaseline = "middle"
            wrap_text(
                context,
                obj.name,
                cell_rect.w,
            ).forEach((line, idx, arr) => {
                context.fillText(
                    line,
                    cell_rect.x + 0.5 * cell_rect.w,
                    cell_rect.y + cell_rect.h / 2 + (0.6 * (1 - arr.length) + idx) * cell_rect.h * 0.2
                )
            });
            
            context.font = "bold 18px sans-serif"
            context.fillStyle = "rgb(128, 128, 128)";
            context.textAlign = "left"
            context.textBaseline = "alphabetic"
            wrap_text(
                context,
                obj.types.join(" + "),
                cell_rect.w - 2 * 5 - 26
            ).forEach((line, idx, arr) => {
                context.fillText(
                    line,
                    cell_rect.x + 5,
                    cell_rect.y + cell_rect.h - 5 + (idx + 1 - arr.length) * 22,
                    cell_rect.w - 2 * 5 - 35,
                )
            });

            context.textAlign = "right"
            context.fillText(
                "diff",
                cell_rect.x + cell_rect.w - 5,
                cell_rect.y + cell_rect.h - 5,
                30
            );

            context.fillStyle = `hsl(${120 * (1 - obj.tier / MAX_TIER)}, 100.00%, 50.00%)`;
            context.fillText(
                obj.tier,
                cell_rect.x + cell_rect.w - 5,
                cell_rect.y + cell_rect.h - 5 - 22,
                30
            );
        });
    });
    const out = fs.createWriteStream("out/bingo.png")
    const stream = canvas.createPNGStream().pipe(out);
    console.log(`Done (${out.path})`);
}

/**
 * @param {Objective[][]} board
 */
function save_board_json(board) {
    // Create a transposed copy of board because BingoSync uses column major order..
    expect(board.length === board[0].length, "Transpose implementation only works on square boards");
    board = board.map((_, row_idx) =>
        board[0].map((_, col_idx) =>
            board[col_idx][row_idx]
        )
    );
    let txt = "";
    txt += "[\n";
    txt += board.flatMap(col =>
        col.map(cell =>
            `     { "name": "${cell.name}" }`
        )
    ).join(",\n");
    txt += "\n]\n";
    fs.writeFileSync("out/bingo.json", txt);
}

const board = generate_board(5, new Interval(10, 14), new Interval(50, 70), "strict");

if (board instanceof Error) {
    console.log(board);
} else {
    save_board_image(board);
    save_board_json(board);
}
