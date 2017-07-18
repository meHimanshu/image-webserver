import * as RetrieveImages from './route-generators/api/retrieve-images';
import * as express from 'express';
var router = express.Router();
import * as fs from 'fs';
import 'reflect-metadata';
import * as ClassValidator from 'class-validator';
import * as ClassTransformer from 'class-transformer';
import * as util from 'util';
import * as path from 'path';

// Configuration file read and validation
namespace ConfigFormat {
    export class Base {
        @ClassValidator.IsDefined()
        webpageFolder: string;
        @ClassValidator.IsDefined()
        websiteUrl: string;
        @ClassValidator.IsDefined()        
        @ClassValidator.ValidateNested()
        @ClassTransformer.Type(() => ImageFolder)
        imageFolders: ImageFolder[];
    }
    export class ImageFolder {
        @ClassValidator.IsDefined()
        directory: string;
        @ClassValidator.IsDefined()
        route: string;
        allRandom: boolean = true;
    }
}
var configuration: ConfigFormat.Base, configFile;
try {
    configFile = fs.readFileSync(process.env.CONFIG_FILE || 'webserver-configuration.json', 'utf8');
}
catch (ex) {
    console.error(ex.message);
    process.exit();
}
let configurationPlain = JSON.parse(configFile);
configuration = ClassTransformer.plainToClass<ConfigFormat.Base, object>(ConfigFormat.Base, configurationPlain);
let errors = ClassValidator.validateSync(configuration)
if (errors.length > 0) {
    console.error("JSON validation failed. Errors: ", util.inspect(errors, { depth: null} ));
    process.exit();
}
export { configuration as Configuration };

// Image parsing stuff

export function isImage(file: string): boolean {
    return fileType(file) === 'image';
}
export function fileType(file: string): string {
    let ret: string;
    let ext: string = path.extname(file);
    switch (ext) {
        case '.webm':
        case '.mp4':
            ret = 'video';
            break;

        default:
            ret = 'image';
            break;
    }
    return ret;
}

// Route stuff
let allRoutesImages: (() => string[])[] = [];

export function InitializeRoutes(): express.Router {
    configuration.imageFolders.forEach((val) => {
        let apiRoute = '/api/' + val.route, staticRoute = '/static/' + val.route,
            randomRoute = '/random/' + val.route;
        let func = (): string[] => {
            return fs.readdirSync(val.directory);
        }
        let funcImages = (): string[] => {
            return func().filter((f) => isImage(f)).
                map((m) => (staticRoute + '/' + m));
        }
        if (val.allRandom) {
            allRoutesImages.push(funcImages);
        }
        router.use(RetrieveImages.CreateImageRoute(apiRoute, staticRoute, func));
        router.use(randomRoute, (req, res) => {
            let images = funcImages();
            res.render('random', { image: images[Math.floor(Math.random() * images.length)]});
        });
        router.use(staticRoute, express.static(val.directory));
    });
    return router;
}

export function getAllPossibleImages(): string[] {
    let ret: string[] = [];
    allRoutesImages.forEach((val) => {
        ret = ret.concat(val());
    });
    return ret;
}