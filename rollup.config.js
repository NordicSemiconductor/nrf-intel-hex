
// import resolve from 'rollup-plugin-node-resolve';
// import commonjs from 'rollup-plugin-commonjs';
// import builtins from 'rollup-plugin-node-builtins';
// import globals from 'rollup-plugin-node-globals';
import buble from 'rollup-plugin-buble';
import pkg from './package.json';

export default [
    // browser-friendly UMD build
    {
        input: pkg.module,
        output: {
            file: pkg.browser,
            format: 'iife',
            sourcemap: true
        },
        name: 'MemoryMap',
        plugins: [
            buble({ transforms: { forOf: false } }),
//             resolve(), // so Rollup can find `crc32`
//             commonjs(),
//             builtins(),
//             globals()
        ]
    },

    // CommonJS (for Node) and ES module (for bundlers) build.
    // (We could have three entries in the configuration array
    // instead of two, but it's quicker to generate multiple
    // builds from a single configuration where possible, using
    // the `targets` option which can specify `dest` and `format`)
    {
        input: pkg.module,
//         external: ['buffer', 'fs', 'jszip'],
        output: [
            { file: pkg.main, format: 'cjs', sourcemap: true },
//             { file: pkg.module, format: 'es', sourcemap: true }
        ],
        plugins: [
            buble({ transforms: { forOf: false } }),
// 			commonjs() // so Rollup can convert `crc32` to an ES module
//             resolve(), // so Rollup can find `crc32`
        ]
    }
];
