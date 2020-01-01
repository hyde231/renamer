import axios from "axios";
import {cli} from "cli-ux";
import walk from "./walk";

const {version} = require("../package.json");
const https = require("https");
const program = require("commander");
const builder = require("xmlbuilder");
const path = require("path");
const inquirer = require("inquirer");
const fs = require("fs");
const mkdirp = require("mkdirp");
const stringFormat = require("string-template");
const clc = require("cli-color");
import {Scene} from "./types";


const API_URL = "https://metadataapi.net";

class PornRenamer {
    private program: any;

    constructor(program: any) {
        this.program = program;
    }

    async warn(text: string) {
        console.log(clc.yellow("WARN: ") + text);
    }

    async error(text: string) {
        console.log(clc.red("ERROR: ") + text);
    }

    async info(text: string) {
        console.log(clc.cyan("INFO: ") + text);
    }

    async success(text: string) {
        console.log(clc.green("SUCCESS: ") + text);
    }

    async run() {
        const dir = this.program.directory;
        const files: Array<string> = [];

        cli.action.start("Scanning Folders");

        await walk(dir, [".mkv", ".avi", ".wmv", ".mp4"], async (file: string) => {
            if (!/sample/.test(file)) {
                files.push(file);
            }
        });

        cli.action.stop("Found " + files.length + " files");

        if (files.length === 0) {
            this.error("No files found, exiting");
            return;
        }

        const progressBar = cli.progress();
        progressBar.start(files.length, 0);

        for (const file of files) {

            let searchTerm: string = "";
            const pathInfo = path.parse(file);
            searchTerm = file.replace(dir, "").replace("\\", "/");

            // if (pathInfo.dir !== dir) {
            //     let folderName = pathInfo.dir;
            //     searchTerm = folderName.replace(dir, "").replace("\\", "");
            // }


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

                this.info(file);
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

            const fileName = stringFormat(program.format, {
                title: scene.title,
                site: scene.site.name,
                date: scene.date,
                performers: scene.performers.map(i => i.name).join(", ")
            });

            const outputFolder = path.join(program.output, fileName);
            const nfoFileName = outputFolder + ".nfo";

            if (!this.program.dry) {
                await mkdirp(path.parse(outputFolder).dir);
            }

            if (this.program.nfo) {
                if (!this.program.dry) {
                    const nfoXml = await this.generateNfo(scene, program.kodi);
                    await fs.writeFile(nfoFileName, nfoXml, () => {
                    });
                }
            }


            const newFileName = outputFolder + pathInfo.ext;

            if (!this.program.dry) {
                if (await fs.existsSync(newFileName)) {
                    console.error(fs.statSync(newFileName));
                    return;
                } else {
                    fs.rename(file, newFileName, (err) => {
                        if (err) {
                            this.error(err.message);
                        } else {
                            this.success("Renamed " + file + " -> " + newFileName);
                        }
                    });
                }
            } else {
                this.success("Renamed " + file + " -> " + newFileName);
            }

            if (this.program.thumbnail) {
                if (!this.program.dry) {
                    if (scene.background.large) {
                        const thumbnailName = path.parse(nfoFileName).dir + "/thumb.jpg";

                        if (!fs.existsSync(thumbnailName)) {
                            const thumbnailFile = await fs.createWriteStream(thumbnailName);
                            https.get(scene.background.large, function (response) {
                                response.pipe(thumbnailFile);
                            });
                        }
                    }

                    if (scene.poster) {
                        const posterName = path.parse(nfoFileName).dir + "/poster.jpg";
                        if (!fs.existsSync(posterName)) {
                            const posterFile = await fs.createWriteStream(posterName);
                            https.get(scene.poster, function (response) {
                                response.pipe(posterFile);
                            });
                        }
                    }
                }
            }

            progressBar.increment(1, {file})
        }

        progressBar.stop()
    }

    /**
     * @param search
     */
    async searchApi(search: string): Promise<Array<Scene>> {
        search = encodeURI(search);
        let rsp = await axios.get(API_URL + "/api/scenes?parse=" + search);
        return rsp.data.data;
    }

    async getScene(uuid: string): Promise<Scene> {
        let rsp = await axios.get(API_URL + "/api/scenes/" + uuid);

        return rsp.data.data;
    }

    async generateNfo(scene: Scene, kodi: boolean = false): Promise<string> {
        let obj = {};

        if (kodi) {
            obj = {
                movie: {
                    title: scene.site.name + ": " + scene.title,
                    studio: scene.site.name,
                    plot: scene.description,
                    premiered: scene.date,
                    thumb: scene.poster,
                    fanart: [
                        {
                            thumb: {
                                "#text": scene.background.large,
                                "@aspect": "landscape"
                            }
                        }
                    ],
                    poster: scene.poster,
                    actor: scene.performers.map(i => {
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
    .version(version)
    .requiredOption("-d, --directory <directory>", "Directory to scan for files", process.cwd())
    .option("-k, --kodi", "Outputs the NFO using Kodi Movie standard", true)
    .option("-n, --nfo", "Create an NFO alongside the video", true)
    .option("-r, --dry", "Don't actually rename any files or make any changes", false)
    .option("-t, --thumbnail", "Save the thumbnail along with the image", true)
    .option("-f, --format <format>", "The format of the filenames", "{site} - {date} - {title}/{site} - {date} - {title} [{performers}]")
    .option("-o, --output <output>", "The folder where we move the folders to", path.join(process.cwd(), "output"))
    .parse(process.argv);

//console.log(command);

let pr = new PornRenamer(command);
pr.run();
