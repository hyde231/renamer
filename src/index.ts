import {Command, flags} from "@oclif/command";
import axios from "axios";

import walk from "./walk";

const builder = require("xmlbuilder");
const util = require("util");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs");
const mkdirp = require("mkdirp");

type Background = {
    small: string
    medium: string
    large: string
}

type Performer = {
    name: string
    image: string
    id: string
}
type Site = {
    name: string
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

class PornRenamer extends Command {
    static description = "describe the command here";

    static flags = {
        // add --version flag to show CLI version
        version: flags.version({char: "v"}),
        help: flags.help({char: "h"}),
        // flag with a value (-n, --name=VALUE)
        directory: flags.string({char: "d", description: "Directory to rename"}),
        // flag with no value (-f, --force)
        force: flags.boolean({char: "f"})
    };

    // static args = [{name: 'file'}];

    async run() {
        const {args, flags} = this.parse(PornRenamer);
        const dir = flags.directory || process.cwd();

        const files: Array<string> = [];
        await walk(dir, [".mkv", "avi", "wmv", "mp4"], async (file: string) => {
            files.push(file);
        });

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
                this.warn("Couldn't parse file: " + file);
                continue;
            }

            if (searchTerm === "") {
                continue;
            }

            let rsp = await this.searchApi(searchTerm);
            if (!rsp.length) {
                this.warn("No search results for " + file);
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

            let scene = await this.getScene(uuid);

            const fileName = util.format(
                "%s/%s - %s - %s [%s]",
                scene.site.name,
                scene.site.name,
                scene.title,
                scene.date,
                scene.performers.map(i => i.name).join(", ")
            );

            console.log("rename " + file + " to " + path.join(dir, fileName, path.extname(file)));

            console.log(path.join(dir, fileName, ".nfo"));
            const nfoFileName = path.join(dir, fileName) + ".nfo";
            const folder = path.dirname(nfoFileName);

            mkdirp(folder);
            fs.writeFile(path.join(dir, fileName) + ".nfo", await this.generateNfo(scene), () => {
                this.log("NFO Created");
            });

        }

    }

    /**
     * @param search
     */
    async searchApi(search: string) {
        let rsp = await axios.get("https://metadataapi.net/api/scenes?q=" + search);
        return rsp.data.data;
    }

    async getScene(uuid: string) {
        let rsp = await axios.get("https://metadataapi.net/api/scenes/" + uuid);

        return rsp.data.data;
    }

    async generateNfo(scene: Scene): Promise<string> {
        const obj = {
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

        return builder.create(obj).end({pretty: true});
    }


}

export = PornRenamer
