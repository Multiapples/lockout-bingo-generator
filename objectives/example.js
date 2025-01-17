/**
 * @typedef {Object} RawObjective
 * @property {string} name The text that shows up on the bingo square.
 * @property {string[]} types A list of 'tags' for this objective. Affects board generation.
 */
/**
 * @type {RawObjective[][]} data[tier][], where
 *  - `tier` is approximately how difficult the objective is to achieve. Affects board generation.
*/
export const data = [
    [
        // Let tier 0 be empty for convenience. This is not required.
    ],
    [
        { "name": "A", "types": ["a"]},
        { "name": "B", "types": ["a", "b"]},
        { "name": "C", "types": ["c"]}
    ],
    [
        { "name": "D", "types": ["c", "d"]},
        { "name": "E", "types": ["d", "e"]},
        { "name": "F", "types": ["d"]}
    ],
    [
        { "name": "G", "types": ["e"]},
        { "name": "H", "types": ["e", "f"]},
        { "name": "I", "types": ["g"]},
        { "name": "J", "types": ["j"]}
    ],
    [
        { "name": "K", "types": ["k"]},
        { "name": "L", "types": ["l"]},
        { "name": "M", "types": ["m"]},
        { "name": "N", "types": ["n"]}
    ],
    [
        { "name": "O", "types": ["o"]},
        { "name": "P", "types": ["p"]},
        { "name": "Q", "types": ["q"]},
        { "name": "R", "types": ["r"]}
    ],
    [
        { "name": "S", "types": ["s"]},
        { "name": "T", "types": ["t"]},
        { "name": "U", "types": ["u"]},
        { "name": "V", "types": ["v"]}
    ],
    [
        { "name": "W", "types": ["w"]},
        { "name": "X", "types": ["x"]},
        { "name": "Y", "types": ["y"]},
        { "name": "Z", "types": ["z"]}
    ]
];