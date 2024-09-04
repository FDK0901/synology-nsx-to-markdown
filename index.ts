import { promises } from "node:fs";
import { parse } from "node:path";
import { unzipSync } from "fflate";
import { v4 as uuidv4 } from "uuid";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { fileTypeFromBuffer } from "file-type";
import * as cheerio from 'cheerio';

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
    //Read directory based off of the variable dir
    const filesList = await promises.readdir(dir);
    //Asynchronously loop all the files.
    for await (const fileName of filesList) {
        //Skip none nsx files.
        if (!fileName.includes(".nsx")) {
            continue;
        }
        const fileToUnzip = await promises.readFile(dir + fileName);
        //Check if a file with extension .nsx is actually a zip file.
        const zipFileType = await fileTypeFromBuffer(fileToUnzip);
        if (zipFileType?.mime !== 'application/zip') {
            throw new Error("This file is not a valid nsx file! : " + fileName);
        }
        //Create a directory to export notes.
        const singleNsxDirectory = "./output_" + parse(fileName).name;
        await promises.mkdir(singleNsxDirectory).catch(async (err: Error) => {
            if (err.message.includes("EEXIST")) {
                await promises.rm(singleNsxDirectory, {
                    recursive: true
                }).then(async () => {
                    await promises.mkdir(singleNsxDirectory);
                });
            }
        });
        //Unzip single .nsx file and uppend it to memory to make a map.
        const unzipped = unzipSync(fileToUnzip);
        //We will use this map to read and write every files inside this .nsx archive.
        const unzippedMap = new Map(Object.entries(unzipped));

        //Read config.json file to see the structure.
        const configJsonUint8Arr = unzippedMap.get("config.json");
        if (configJsonUint8Arr === undefined) {
            throw new Error("This file includes malformed config.json file. : " + fileName);
        }
        const numArr = Array.from(configJsonUint8Arr);
        const jsonString = String.fromCharCode.apply(null, numArr);
        const configJson: {
            note: string[] | null;
            notebook: string[] | null;
            todo: string[] | null;
            shortcut: string[] | null;
        } = JSON.parse(jsonString);

        //Create a map of all the notebooks. Key shall be the synology key, and value shall be respective directory name.
        const notebookMap: Map<string, string> = new Map();

        //Iterage through each and every notebooks
        if (configJson.notebook !== null) {
            for await (const notebook of configJson.notebook) {
                const notebookUint8Arr = unzippedMap.get(notebook);
                if (notebookUint8Arr !== undefined) {
                    const jsonString = Utf8ArrayToStr(notebookUint8Arr);
                    const jsonObject = JSON.parse(jsonString);
                    let notebookName = jsonObject.title.trim().replace("\n", "").replace("\r", "");
                    if (notebookName === undefined || notebookName === "") {
                        notebookName = "untitled_" + uuidv4();
                    }
                    //Create nested directories accordingly
                    await promises.mkdir(singleNsxDirectory + "/" + notebookName).catch(async (err: Error) => {
                        if (err.message.includes("EEXIST")) {
                            notebookName = notebookName + "_" + uuidv4();
                            await promises.mkdir(singleNsxDirectory + "/" + notebookName);
                        }
                    }).finally(() => {
                        notebookMap.set(notebook, notebookName);
                    });
                }
            }
            await promises.mkdir(singleNsxDirectory + "/" + "attachment").catch(async (err: Error) => {
                if (err.message.includes("EEXIST")) {
                    await promises.rm(singleNsxDirectory + "/" + "attachment", {
                        recursive: true
                    }).then(async () => {
                        await promises.mkdir(singleNsxDirectory + "/" + "attachment");
                    });
                }
            })

        }

        //Iterate through each and every notes
        if (configJson.note !== null) {
            for await (const note of configJson.note) {
                const noteUint8Arr = unzippedMap.get(note);
                if (noteUint8Arr !== undefined) {
                    const jsonString = Utf8ArrayToStr(noteUint8Arr);
                    const jsonObject = JSON.parse(jsonString);

                    const parent_id = jsonObject.parent_id;
                    const title = jsonObject.title.length > 20 ? jsonObject.title.substring(0, 20).replace("/", "_") : jsonObject.title.replace("/", "_");
                    const content = jsonObject.content;

                    const $ = cheerio.load(content);

                    const attachment = jsonObject.attachment;

                    if (attachment !== undefined) {
                        for await (const attSym of Object.entries<any>(attachment)) {
                            const attObject = attSym[1];
                            const attFileName = attObject.name;
                            const attMD5 = attObject.md5;
                            const attRef = attObject.ref;
                            const attType = attObject.type;

                            //Get file content from md5 hash.
                            const attFileUint8Arr = unzippedMap.get("file_" + attMD5);
                            if (attFileUint8Arr !== undefined) {
                                //Save file content with original file name to attachment directory.
                                await promises.writeFile(singleNsxDirectory + "/" + "attachment" + "/" + attFileName, attFileUint8Arr);

                                //Not an image, then replace it with anchor.
                                if (!attType.includes("image")) {
                                    $('a').append(`<a href="../attachment/${attFileName}">${attFileName}</a>`)
                                } else {
                                    //Image, so we just replace the source.
                                    $(`img[ref=${attRef}]`).replaceWith(
                                        function () {
                                            return $(this).attr("src", `../attachment/${attFileName}`);
                                        }
                                    );
                                }
                            }
                        }
                    }
                    const translator = new NodeHtmlMarkdown();
                    const md = translator.translate($.html());

                    const directoryToSave = notebookMap.get(parent_id);
                    const savePath = singleNsxDirectory + "/" + directoryToSave + "/" + title + ".md";
                    await promises.writeFile(savePath, md).catch(async (err: Error) => {
                        await promises.writeFile("./" + title + ".md", md);
                    });

                }
            }
        }

    }
    process.exit();

})().catch((e) => console.log(e));