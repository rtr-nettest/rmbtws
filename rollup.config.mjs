import terser from "@rollup/plugin-terser";
import babel from "@rollup/plugin-babel";
import { readFileSync } from "fs";

const removeExports = () => {
    return {
        name: "remove-exports",
        renderChunk(code) {
            const exportStart = code.indexOf(`export {`);
            if (exportStart > 0) {
                return {
                    code: code.slice(0, exportStart),
                    map: null,
                };
            }
            return null;
        },
    };
};

const addBackLicense = () => {
    return {
        name: "add-back-license",
        renderChunk(code) {
            const license = readFileSync("index.js", "utf-8").split(
                '"use strict";',
            )[0];
            return {
                code: license + code,
                map: null,
            };
        },
    };
};

export default {
    input: "index.js",
    output: [
        // Legacy
        {
            file: "dist/rmbtws.js",
            plugins: [removeExports()],
        },
        {
            file: "dist/rmbtws.min.js",
            plugins: [
                removeExports(),
                terser({
                    output: {
                        comments: "some",
                    },
                }),
                addBackLicense(),
            ],
            sourcemap: true,
        },
        // ESM
        {
            file: "dist/esm/rmbtws.js",
        },
        {
            file: "dist/esm/rmbtws.min.js",
            plugins: [
                terser({
                    output: {
                        comments: "some",
                    },
                }),
            ],
            sourcemap: true,
        },
    ],
    plugins: [
        babel({
            presets: ["@babel/preset-env"],
        }),
    ],
    treeshake: true,
};
