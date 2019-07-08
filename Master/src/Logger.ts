// tslint:disable:no-console
import chalk from "chalk";

export class Logger {
    public static shout(msg: string) {
        console.log(chalk`{magentaBright ${msg}}`);
    }

    public static moreInfo(highlight: string, msg: string) {
        console.log(chalk`{white INFO}: {yellowBright ${highlight}} {grey ${msg}}`);
    }

    public static info(msg: string) {
        console.log(chalk`{blue INFO:} {white ${msg}}`);
    }

    public static success(msg: string) {
        console.log(chalk`{bgGreen {black SUCCESS:}} {green ${msg}}`);
    }
    public static warn(msg: string) {
        console.log(chalk`{yellowBright WARN:} {yellowBright ${msg}}`);
    }

    public static error(msg: string) {
        console.log(chalk`{redBright ERROR:} {redBright ${msg}}`);
    }
}