
## Table of contents

1. [Introduction]
2. [InstallPackages]
3. [Build]
4. [Usage]
5. [Examples]

## Introduction 
This utility contains a command line interface used to update yaml files using a template to format the shape of the reference data. Old file won't be overwritten, insted a new file with the same name will be produced and saved to output folder. This utility will look through the known types and if match is found it will update it. If type is not found the data would not be replaced.

##Install Packages

In a command window, cd to the project folder where the package.json is located.
Run npm run install.
You should now be able to build and run the application.

##Build

Run npm run build to build the project. 

## Usage
If this is the first time using this utility run npm link.
To start the app run npm run start and then command below in the new terminal:
Usage: swagger [options]
Options: 
-d --data <data>            Yaml file to be changed
-r --reference <reference>  File with new reference data structure

##Examples

The usage of the utility requires providing a path to a yaml file that has to be updated and path to a file containing an object that will replace the matching types.
e.g. swagger -d ./swagger-file/adviserCharges-v1.yaml -r ./ref-data-template/ref-data.json