import terser from "@rollup/plugin-terser";
import babel from "@rollup/plugin-babel";

const outPlugins = [
    terser({
        output: {
            comments: "some",
        },
    }),
];

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
            plugins: [removeExports(), ...outPlugins],
            sourcemap: true,
        },
        // ESM
        {
            file: "dist/esm/rmbtws.js",
        },
        {
            file: "dist/esm/rmbtws.min.js",
            plugins: outPlugins,
            sourcemap: true,
        },
    ],
    plugins: [
        babel({
            presets: ["@babel/preset-env"],
        }),
    ],
    treeshake: false,
};
