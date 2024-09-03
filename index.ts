import { promises } from "node:fs";
import { parse } from "node:path";
import { unzipSync } from "fflate";
import { v4 as uuidv4 } from "uuid";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { fileTypeFromBuffer } from "file-type";

/* utf.js - UTF-8 <=> UTF-16 convertion
 *
 * Copyright (C) 1999 Masanao Izumo <iz@onicos.co.jp>
 * Version: 1.0
 * LastModified: Dec 25 1999
 * This library is free.  You can redistribute it and/or modify it.
 */
function Utf8ArrayToStr(array: Uint8Array) {
    let out: string, i: number, len: number, c: any;
    let char2: any, char3: any;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0: case 1: case 2: case 3: case 4: case 5: case 6: case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12: case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }
    return out;
}

function findNoteBookNameFromId(id: string, bookArr: { name: string, value: string }[]) {
    let folderName = "indeterminant";
    bookArr.forEach((element) => {
        if (element.value === id) {
            folderName = element.name;
        }
    });
    return folderName;
}

const dir = "./place_nsx_here/";

(async () => {
    const filesList = await promises.readdir(dir);
    for await (const fileName of filesList) {
        if (!fileName.includes(".nsx")) {
            throw new Error("Not an nsx file!");
        }
        const fileToUnzip = await promises.readFile(dir + fileName);
        const singleNsxDirectory = "./output_" + parse(fileName).name;
        await promises.mkdir(singleNsxDirectory);
        const unzipped = unzipSync(fileToUnzip);
        const unzippedArr = Object.entries(unzipped);
        let configJson: {
            note: string[];
            notebook: string[];
            todo: string[];
        } = {
            note: [],
            notebook: [],
            todo: [],
        };
        let noteBookArray: { name: string, value: string }[] = [];
        let noteArray: { name: string, value: string, notebook: string }[] = [];
        let attachmentDirCreated = false;
        for await (const unzippedKeyValue of unzippedArr) {
            const unzippedFileName = unzippedKeyValue[0];
            const unzippedFileContent = unzippedKeyValue[1];
            if (unzippedFileName === "config.json") {
                const numArr = Array.from(unzippedFileContent);
                const jsonString = String.fromCharCode.apply(null, numArr);
                configJson = JSON.parse(jsonString);
            } else {
                if (unzippedFileName.startsWith("nb")) {
                    const jsonString = Utf8ArrayToStr(unzippedFileContent);
                    const notebookJson = JSON.parse(jsonString);
                    let noteBookName: string = "";
                    await promises.mkdir(singleNsxDirectory + "/" + notebookJson.title.replace(" ", ""))
                        .then((_) => {
                            noteBookName = notebookJson.title.replace(" ", "");
                        })
                        .catch(async (err: Error) => {
                            if (err.message.includes("EEXIST")) {
                                const newUuid = uuidv4();
                                await promises.mkdir(singleNsxDirectory + "/" + notebookJson.title.replace(" ", "") + newUuid);
                                noteBookName = notebookJson.title.replace(" ", "") + newUuid;
                            }
                        });
                    noteBookArray.push({
                        name: noteBookName,
                        value: unzippedFileName,
                    });
                } else if (unzippedFileName.startsWith("note")) {
                    const abc = "";
                    const jsonString = Utf8ArrayToStr(unzippedFileContent);
                    const noteJson = JSON.parse(jsonString);
                    const noteTitle = noteJson.title.length > 20 ? noteJson.title.substring(0, 20).replace("/", "_") : noteJson.title.replace("/", "_");
                    const noteContent = noteJson.content;
                    const noteBookId = noteJson.parent_id;
                    const noteAtt = Object.entries(noteJson.attachment);
                    const translator = new NodeHtmlMarkdown();
                    const noteMD = `# ${noteTitle}` + translator.translate(noteContent);
                    noteArray.push({
                        name: noteTitle,
                        value: noteMD,
                        notebook: noteBookId,
                    });
                } else if (unzippedFileName.startsWith("file")) {
                    const fileType = await fileTypeFromBuffer(unzippedFileContent);
                    if (fileType !== undefined) {
                        if (!attachmentDirCreated) {
                            await promises.mkdir(singleNsxDirectory + "/attachment");
                            attachmentDirCreated = true;
                        }
                        await promises.writeFile(singleNsxDirectory + "/attachment" + "/" + unzippedFileName + "." + fileType.ext, unzippedFileContent);
                    }
                }
            }
        }
        await promises.mkdir(singleNsxDirectory + "/" + "indeterminant");
        for await (const note of noteArray) {
            const notebookId = note.notebook;
            const savePath = singleNsxDirectory + "/" + findNoteBookNameFromId(notebookId, noteBookArray) + "/" + note.name + ".md";
            await promises.writeFile(savePath, note.value).catch(async (err) => {
                await promises.writeFile("./" + note.name + ".md", note.value);
            });
        }


    }
    process.exit();

})().catch((e) => console.log(e));