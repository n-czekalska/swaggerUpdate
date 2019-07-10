import * as fse from "fs-extra";
import * as yaml from "js-yaml";
import * as path from "path";
import { Logger } from "./Logger";

const types: string[] = fse.readJSONSync("./ref-data-template/types.json");
const undefinedTypes = new Array<string>();
const changesMade = new Array<Changes>();
const allGetModels = new Array<string>();
const listOfCopiedModels = new Array<string>();
const postfix: string = "Get";

export function updateSwagger(swaggerFile: string, referenceDataFile: string) {

  const extension: string = path.extname(swaggerFile);
  const fileName: string = path.basename(swaggerFile, extension);
  let swaggerData: string;
  let newSwaggerData: string;
  const refData = fse.readJSONSync(referenceDataFile);

  if (!fse.existsSync("./output")) {
    fse.mkdirSync("./output");
  }

  swaggerData = loadData(swaggerFile, extension);
  newSwaggerData = processSwagger(swaggerData, refData);
  saveNewData(newSwaggerData, fileName, extension);
  saveChangesAndUndefined(fileName);

  Logger.success("Swagger data has been successfully updated");
}

function loadData(swaggerFile: string, extension: string): string {
  if (extension === ".yaml") {
    return yaml.safeLoad(fse.readFileSync(swaggerFile, "utf-8"));
  } else {
    return fse.readJSONSync(swaggerFile);
  }
}

function saveNewData(newSwaggerData: string, fileName: string, extension: string) {
  if (extension === ".yaml") {
    fse.writeFileSync("./output/" + fileName + extension,
    yaml.safeDump(newSwaggerData, { noRefs: true }));
  } else {
    fse.writeJSONSync("./output/" + fileName + extension, newSwaggerData, { spaces: 2 });
  }
}

function saveChangesAndUndefined(fileName: string) {
  fse.writeJSONSync("./output/" + fileName + "-undefinedTypes.json",
    undefinedTypes, { spaces: 2 });

  fse.writeJSONSync("./output/" + fileName + "-changesHistory.json",
    changesMade, { spaces: 2 });
}

function processSwagger(swaggerData: any, refData: any): any {
  const copySwaggerData = deepCopy(swaggerData);
  const allGetOps: string[] = findAllGetOpperations(copySwaggerData);
  const topLevelGetModels: string[] = findAllResponseModels(copySwaggerData, allGetOps);
  createListOfAllGetModels(copySwaggerData, topLevelGetModels);

  copySwaggerData.definitions.referenceData = refData.referenceData;
  copySwaggerData.definitions.property = refData.property;
  const modelsToAdd = createListOfObjectsToIterate(topLevelGetModels, allGetModels);
  let newData = addNewGetModels(copySwaggerData, refData, modelsToAdd);
  const modelsToUpdate = createListOfObjectsToIterate(topLevelGetModels, listOfCopiedModels, postfix);
  upadePathsToNewModels(newData, modelsToUpdate);
  updatePathsInResponses(newData, allGetOps, listOfCopiedModels);
  newData = findAndRemoveUnusedDefinitions(newData);
  return newData;
}

function findAllGetOpperations(doc: any): string[] {
  return Object.keys(doc.paths).filter((k) => !!doc.paths[k].get);
}

function findAllResponseModels(doc: any, allGetOps: string[]): string[] {
  return allGetOps
    .map((i) =>
      Object.keys(doc.paths[i].get.responses)
        .filter((r) => r.match(/(20[0-9])/))
        .map((r) => doc.paths[i].get.responses[r].schema.$ref)
        .map(getModelName))
    .reduce((a, c) => a.concat(c));
}

function getModelName(pathToModel: string) {
  const splitPath = pathToModel.split("/");
  return splitPath[splitPath.length - 1];
}

function createListOfAllGetModels(doc: any, allModels: string[]) {
  allModels.forEach((m) => {
    findChildModels(doc, doc.definitions[m]);
  });
}

function findChildModels(doc: any, model: any) {
    Object.keys(model).forEach((child) => {
      if (child === "$ref") {
         const modelName = model[child].split(/[/\\]/);
         allGetModels.push(modelName[modelName.length - 1]);
         createListOfAllGetModels(doc, [getModelName(model[child])]);
      }
      if (model[child] instanceof Object) {
        findChildModels(doc, model[child]);
      }
    });
}

function addNewGetModels(copySwaggerData: any, refData: any, getModels: string[]): any {
  getModels.forEach((model) => {
    if (copySwaggerData.definitions[model] && isUsingeReferenceData(copySwaggerData.definitions[model])) {
      copySwaggerData.definitions[`${model}${postfix}`] = deepCopy(copySwaggerData.definitions[model]);
      listOfCopiedModels.push(`${model}`);
      copySwaggerData.definitions[`${model}${postfix}`]  = mapReferenceTypes(`${model}${postfix}`,
      copySwaggerData.definitions[`${model}${postfix}`], refData);
    }
  });
  return copySwaggerData;
}

function isUsingeReferenceData(model: any): boolean {
  let hasReferenceTypes = false;
  if (model.properties) {
    Object.keys(model.properties).forEach((key) => {
      if (types.indexOf(key) > -1) {
        hasReferenceTypes = true;
      }
    });
  }
  return hasReferenceTypes;
}

function mapReferenceTypes(updatedObject: string, model: any, refData: any): any {
  Object.keys(model.properties).forEach((key) => {
      if (types.indexOf(key) > -1) {
          model.properties[key] = mapAndSaveHistoryOfChanges(updatedObject, model.properties[key], key, refData);
      } else if (key.includes("Type" || "Status") && undefinedTypes.indexOf(key) === -1
          && model.properties[key].$ref === undefined) {
          undefinedTypes.push(key);
      }
  });
  return model;
}

function mapAndSaveHistoryOfChanges(updatedObject: string, data: any, key: string, refData: any): any {
    createHistoryReport(updatedObject, data, key, refData.$ref);
    data = mapReferenceTypeObjectGet(key, refData);
    return data;
}

function createHistoryReport(updatedObject: string, data: any, key: string, newValue: string): void {
  const changes = new Changes(updatedObject + ": " + key , new Change());
  changes.entry.oldValue = deepCopy(data);
  changes.entry.newValue = newValue;
  changesMade.push(changes);
}

function mapReferenceTypeObjectGet(type: string, refData: any): string {
  Logger.info("updated Get: " + type);
  return refData.$ref;
}

function upadePathsToNewModels(doc: any, allModels: string[]) {
  allModels.forEach((m) => {
    if (!!doc.definitions[m]) {
    upadePathsInChildModels(doc, doc.definitions[m]);
   }
  });
}

function  upadePathsInChildModels(doc, model: any) {
    Object.keys(model).forEach((child) => {
      if (listOfCopiedModels.indexOf(child) > -1 ) {
        findReferencePath(model[child]);
      }
      if (child === "$ref") {
        if (listOfCopiedModels.indexOf(getModelName(model[child])) > -1 ) {
         model[child] = model[child] + `${postfix}`;
        } else {
          upadePathsToNewModels(doc, [getModelName(model[child])]);
        }
      }
      if (model[child] instanceof Object) {
        upadePathsInChildModels(doc, model[child]);
      }
    });
}

function findReferencePath(modelToUpdate: any) {
  Object.keys(modelToUpdate).forEach((child) => {
    if (child === "$ref" && !modelToUpdate[child].includes(postfix) ) {
        modelToUpdate[child] = modelToUpdate[child] + postfix;
    }
    if (modelToUpdate[child] instanceof Object) {
      findReferencePath(modelToUpdate[child]);
    }
  });
}

function createListOfObjectsToIterate(getModels: string[], newModels: string[], suffix?: string): string[] {
  const combinedGetModels = deepCopy(getModels);
  newModels.forEach((model) => {
    combinedGetModels.push(suffix ?  model + suffix : model);
  });
  return combinedGetModels;
}

function updatePathsInResponses(doc: any, allGetOps: string[], modelsToUpdate: string[]): void {
   allGetOps.forEach((operationPath) =>
    Object.keys(doc.paths[operationPath].get.responses)
      .filter((response) => response.match(/(20[0-9])/))
      .map((response) => updatePath(doc, operationPath,
        response, doc.paths[operationPath].get.responses[response].schema.$ref, modelsToUpdate)));
}

function updatePath(doc: any, operationPath: string, response: string, reference: string,
                    modelsToUpdate: string[]): void {
  if (modelsToUpdate.indexOf(getModelName(reference)) > -1) {
    doc.paths[operationPath].get.responses[response].schema.$ref += postfix;
  }
 }

function findAndRemoveUnusedDefinitions(doc: any) {
    let countOfDeletedItems: number = 0;
    let document = doc;
    do {
      countOfDeletedItems = 0;
      let listOfReferences: string[] = [];
      listOfReferences = findAllReferences(document, listOfReferences);
      const returnedValues = removeUnusedDefinitions(document, listOfReferences, countOfDeletedItems);
      document = returnedValues[0];
      countOfDeletedItems = returnedValues[1];
    } while (countOfDeletedItems > 0);

    return document;
}

function findAllReferences(doc: any, listOfReferences: string[]): string[] {
  for (const key in doc) {
    if (!!doc[key] && typeof(doc[key]) === "object") {
        findAllReferences(doc[key], listOfReferences);
    } else {
      if (key === "$ref" && listOfReferences.indexOf(getModelName(doc[key])) === -1) {
        listOfReferences.push(getModelName(doc[key]));
       }
    }
  }
  return listOfReferences;
}

function removeUnusedDefinitions(doc: any, references: string[], count: number): any {
  Object.keys(doc.definitions).forEach((key) => {
    if (references.indexOf(key) === -1) {
      createHistoryReport(key, doc.definitions[key], null, "deleted");
      delete doc.definitions[key];
      count++;
    }
  });
  return [doc, count];
}

export const deepCopy = <T>(target: T): T => {
  if (target === null) {
    return target;
  }
  if (target instanceof Date) {
    return new Date(target.getTime()) as any;
  }
  if (target instanceof Array) {
    const cp = [] as any[];
    (target as any[]).forEach((v) => { cp.push(v); });
    return cp.map((n: any) => deepCopy<any>(n)) as any;
  }
  if (typeof target === "object" && target !== {}) {
    const cp = { ...(target as { [key: string]: any }) } as { [key: string]: any };
    Object.keys(cp).forEach((k) => {
      cp[k] = deepCopy<any>(cp[k]);
    });
    return cp as T;
  }
  return target;
};

export class Changes {
  public type: string;
  public entry: Change;

  constructor();

  constructor(type: string, entry: Change);

  constructor(type?: string, entry?: Change) {
    this.type = type;
    this.entry = entry;
  }
}

// tslint:disable-next-line: max-classes-per-file
export class Change {
  public oldValue: string[];
  public newValue: string;

  constructor();

  constructor(oldValue: string[], newValue: string);

  constructor(oldValue?: string[], newValue?: string) {
    this.oldValue = oldValue;
    this.newValue = newValue;
  }
}
