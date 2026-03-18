import { terser } from "rollup-plugin-terser";
import babel from "@rollup/plugin-babel";

const outPlugins = [
    terser({
        output: {
            comments: "some",
        },
    }),
];

const trimBeforeLicense = () => {
    return {
        name: "trim-before-license",
        renderChunk(code) {
            const licenseStart =
                code.indexOf(`/*!******************************************************************************
 * @license`);
            if (licenseStart > 0) {
                return {
                    code: code.slice(licenseStart),
                    map: null,
                };
            }
            return null;
        },
    };
};

export default {
    input: "src/index.js",
    output: [
        {
            file: "dist/rmbtws.js",
        },
        {
            file: "dist/esm/rmbtws.js", // remove after the website is updated to use the dist path
        },
        {
            file: "dist/rmbtws.min.js",
            plugins: outPlugins,
            sourcemap: true,
        },
        {
            file: "dist/esm/rmbtws.min.js", // remove after the website is updated to use the dist path
            plugins: outPlugins,
            sourcemap: true,
        },
    ],
    plugins: [
        babel({
            presets: ["@babel/preset-env"],
        }),
        trimBeforeLicense(),
    ],
    treeshake: false,
};
