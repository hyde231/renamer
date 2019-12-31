import axios from "axios";
import {cli} from "cli-ux";
import walk from "./walk";

const program = require("commander");
const builder = require("xmlbuilder");
const util = require("util");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs");
const mkdirp = require("mkdirp");
const stringFormat = require("string-template");
require("./types");

type Performer = {
    name: string
    image: string
    id: string
}
type Site = {
    name: string
    id: string
}
type Tag = {
    id: number
    tag: string
}
type Scene = {
    id: string
    title: string
    description: string
    site_id: number
    date: string
    url: string
    poster: string
    background: Background,
    created: string
    last_updated: string
    performers: Array<Performer>
    site: Site
    tags: Array<Tag>
}

type Background = {
    large: string
    medium: string
    small: string
}


class PornRenamer {
    private program: any;

    constructor(program: any) {
        this.program = program;
    }

    async run() {
        const dir = this.program.directory;
        const files: Array<string> = [];
        await walk(dir, [".mkv", "avi", "wmv", "mp4"], async (file: string) => {
            files.push(file);
        });

        if (files.length === 0) {
            cli.error("No files found, exiting");
            cli.exit();
        }

        for (const file of files) {

            let searchTerm: string = "";

            if (/([A-Za-z0-9- ]+?)\W+?(\d+\.\d+\.\d+)\W+?(.+?)\W+?XXX/.test(file)) {
                const match = file.match(/([A-Za-z0-9- ]+?)\W+?(\d+\.\d+\.\d+)\W+?(.+?)\W+?XXX/);
                if (match) {
                    searchTerm = match[1] + " " + match[3].split(".").join(" ");
                }
            } else if (/([A-Za-z0-9- ]+?) - (\d+\W+?\d+\W+?\d+) - (.+?) - \[.+]/.test(file)) {
                const match = file.match(/([A-Za-z0-9- ]+?) - (\d+\W+?\d+\W+?\d+) - (.+?) - \[.+]/);
                if (match) {
                    searchTerm = match[1] + " " + match[3].split(".").join(" ");
                }
            } else if (/([A-Za-z0-9- ]+?) - (\d+\W+?\d+\W+?\d+) - (.+?) \[(.+?)]/.test(file)) {
                const match = file.match(/([A-Za-z0-9- ]+?) - (\d+\W+?\d+\W+?\d+) - (.+?) \[(.+?)]/);
                if (match) {
                    searchTerm = match[1] + " " + match[3].split(".").join(" ") + " " + match[4].split(", ").join(" ");
                }
            } else {
                cli.warn("Couldn't parse file: " + file);
                continue;
            }

            if (searchTerm === "") {
                continue;
            }

            let rsp = await this.searchApi(searchTerm);
            if (!rsp.length) {
                cli.warn("No search results for " + file);
                continue;
            }

            let uuid = "";

            if (rsp.length > 1) {
                let choices = rsp.map(i => {
                    return {
                        name: i.site.name + " " + i.title + " " + i.date,
                        value: i.id
                    };
                });

                choices.unshift({
                    name: "Skip",
                    value: "_"
                });

                let choice = await inquirer.prompt({
                    name: "scene",
                    message: "Multiple scenes found; Which one is correct?",
                    type: "list",
                    choices: choices
                });

                if (choice["scene"] === "_") {
                    continue;
                }

                uuid = rsp.filter(scene => scene.id === choice["scene"])[0]["id"];
            } else {
                uuid = rsp[0]["id"];
            }

            const scene = await this.getScene(uuid);

            // const fileName = util.format(
            //     "%s/%s - %s - %s [%s]",
            //     scene.site.name,
            //     scene.site.name,
            //     scene.title,
            //     scene.date,
            //     scene.performers.map(i => i.name).join(", ")
            // );

            const fileName = stringFormat(program.format, {
                title: scene.title,
                site: scene.site.name,
                date: scene.date,
                performers: scene.performers.map(i => i.name).join(', ')
            });

            cli.log("rename to " + path.join(dir, fileName) + path.extname(file));

            const nfoFileName = path.join(dir, fileName) + ".nfo";
            const folder = path.dirname(nfoFileName);

            mkdirp(folder);
            fs.writeFile(path.join(dir, fileName) + ".nfo", await this.generateNfo(scene, program.kodi), () => {
                cli.log("NFO Created");
            });

        }

    }

    /**
     * @param search
     */
    async searchApi(search: string): Promise<Array<Scene>> {
        let rsp = await axios.get("https://metadataapi.net/api/scenes?q=" + search);
        return rsp.data.data;
    }

    async getScene(uuid: string): Promise<Scene> {
        let rsp = await axios.get("https://metadataapi.net/api/scenes/" + uuid);

        return rsp.data.data;
    }

    async generateNfo(scene: Scene, kodi: boolean = false): Promise<string> {
        let obj = {};

        if (kodi) {
            obj = {
                movie: {
                    title: scene.title,
                    studio: scene.site.name,
                    plot: scene.description,
                    premiered: scene.date,
                    thumb: [
                        {
                            "#text": scene.background.large,
                            "@aspect": "landscape"
                        },
                        {
                            "#text": scene.poster,
                            "@aspect": "poster"
                        }
                    ],

                    poster: scene.poster,
                    performer: scene.performers.map(i => {
                        return {
                            name: i.name,
                            thumb: i.image,
                            role: i.name
                        };
                    }),
                    genre: scene.tags.map(t => t.tag),
                    uniquid: {
                        "@type": "tpdb",
                        "#text": scene.id
                    }
                }
            };
        } else {
            obj = {
                scene: {
                    title: scene.title,
                    studio: scene.site.name,
                    description: scene.description,
                    released: scene.date,
                    thumb: scene.background.large,
                    poster: scene.poster,
                    performers: {
                        performer: scene.performers.map(i => {
                            return {
                                name: i.name,
                                image: i.image,
                                id: i.id
                            };
                        })
                    },
                    tags: {
                        tag: scene.tags.map(t => t.tag)
                    }
                }
            };
        }

        return builder.create(obj).end({pretty: true});
    }
}

let command = program
    .version("0.0.1")
    .requiredOption("-d, --directory <directory>", "Directory to scan for files", process.cwd())
    .option("-k, --kodi", "Outputs the NFO using Kodi Movie standard", false)
    .option("-f, --format <format>", "The format of the filenames", "{site} - {title} - {date} [{performers}]")
    .parse(process.argv);

//console.log(command);

let pr = new PornRenamer(command);
pr.run();

