import fs from "fs";
import path from "path";

function main() {
    const files = fs.readdirSync(path.resolve("src"));
    const fileContents = {};
    for (const file of files) {
        if (file === "index.js") {
            continue;
        }
        const content = fs.readFileSync(path.resolve("src", file), "utf-8");
        fileContents[file] = content;
    }
    let concatenatedContent = "";
    for (const [_, content] of Object.entries(fileContents).sort(
        ([fileA], [fileB]) =>
            fileA === "Websockettest.js"
                ? -1
                : fileB === "Websockettest.js"
                  ? 1
                  : fileA.localeCompare(fileB),
    )) {
        concatenatedContent += `${content}\n\n`;
    }

    fs.writeFileSync(path.resolve("index.js"), concatenatedContent, "utf-8");
}

main();
