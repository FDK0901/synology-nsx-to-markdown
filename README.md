# A WIP Synology Note Station export to markdown converter

## Why?

This is a proof of concept synology note station to markdown converter. The original intent was to convert each and every notes to be used within logseq.

## What?

As you might witness, the code itself is very messy. 
It's intended as a simple script for my personal use, so it had to be quick and dirty...
So synology proprietary *.nsx files are just plain old zip files. 
With config.json file in place, it guides the list of notebooks, noteds, todos, and shortcuts.
Notebooks are like folders, and each notes are json files with html content.
Attachments are descripted inside each notes, and will be saved inside folder "attachment".
Image attachment will replace img tag's source.
Other files will be converted into anchor tags.

## How?

Put your nsx files inside ./place_nsx_here directory.

```bash

npm i

```

Then, just run 

```bash

npm run convert

```

## Limitations
* Compatibility with older Note Station exports are not thoroughly tested.
* TODO List, and shortcuts are not supported (yet).
* Do note that logseq image files have different referencing scheme. This is not implemented (yet).
