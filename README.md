porn-renamer
============

A cli to rename your porn files using http://metadataapi.net
<!-- usagestop -->
# Usage
Download the latest version https://github.com/ThePornDB/renamer/releases

run the command to see options ./porn-renamer -h

example: ./porn-renamer -d /mnt/nas/porn-downloads -o /mnt/nas/porn 

This will search for files in the -d directory and move them to the -o directory

You can also format how you want the filename to be named; Defaults to : `{site} - {date} - {title}/{site} - {date} - {title} [{performers}]`

Use -r to do a Dry run first as this tool is destructive. To be even safer run it with the -l flag to hardlink everything.
```
Usage: ./porn-renamer [options]

Options:
  -V, --version                output the version number
  -d, --directory <directory>  Directory to scan for files (default: "/root/porn-renamer/build")
  -k, --kodi                   Outputs the NFO using Kodi Movie standard (default: true)
  -n, --nfo                    Create an NFO alongside the video (default: true)
  -r, --dry                    Don't actually rename any files or make any changes (default: false)
  -t, --thumbnail              Save the thumbnail along with the image (default: true)
  -f, --format <format>        The format of the filenames (default: "{site} - {date} - {title}/{site} - {date} - {title} [{performers}]")
  -o, --output <output>        The folder where we move the folders to (default: "/root/porn-renamer/build/output")
  -l, --hardlink               Hard links the file to the output instead of moving (default: false)
  -h, --help                   output usage information
```

<!-- commands -->

<!-- commandsstop -->
 
