import * as program from "commander";
import * as fse from "fs-extra";
import { Logger } from "./Logger";
import { updateSwagger } from "./updateSwagger";

export function start(args: string[]) {

    program.description("Updates swagger with new ref data objects instead of key")
        .option("-d --data <data>", "Yaml swagger file")
        .option("-r --reference <reference>", "New structure of reference data");

    program.parse(args);
    const NO_COMMAND_SPECIFIED = (!program.data || !program.reference);

    if (NO_COMMAND_SPECIFIED) {
        program.help();
    }
    if (!fse.existsSync(program.data)) {
        Logger.warn("Incorrect swagger file or directory: " + program.data);
        return;
    }
    if (!fse.existsSync(program.reference)) {
        Logger.warn("Incorrect reference data file or directory: " + program.reference);
        return;
    }
    updateSwagger(program.data, program.reference);
}