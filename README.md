# A WIP Synology Note Station export to markdown converter

## Why?

This is a proof of concept synology note station to markdown converter. The original intent was to convert each and every notes to be used within logseq.

## What?

As you might witness, the code itself is very messy. It's intended as a simple script for my personal use, so it had to be quick and dirty...
So synology proprietary *.nsx files are just plain old zip files. It just have files with file_, note_, and nb_ prefix.
file_ file obviously are attatchment files, with md5 hash to determine which is which. note_ files are json files, with their value of "contents" key being plain html.
nb_ files are notebook files, which are like folders for aggregating all the notes. Hence, this script treats it as a subdirectory for export.

## How?

Put your nsx files inside ./place_nsx_here directory.

```bash

npm

```

Then, just run 

```bash

npm run convert

```

## Limitations

Note attatchment file are also here, but it is not yet associated with individual notes. 
Note that it shall be done easily with values of "attatchment" key of each notes, while they have md5 hashes and original file names.