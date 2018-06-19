//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------
import { IDictionary } from "sfx.common";
import { IModuleManager } from "sfx.module-manager";

import { BrowserWindow, Certificate } from "electron";
import * as url from "url";
import * as fs from "fs";
import * as tmp from "tmp";
import { Buffer } from "buffer";

import { electron } from "../electron-adapter";
import { env, Platform } from "../env";
import { local } from "../resolve";
import * as utils from "../utils";

interface ICertSelectionPromptResults {
    selectedCert: Certificate;
    certsImported: boolean;
}

async function showCertSelectPromptAsync(
    moduleManager: IModuleManager,
    window: BrowserWindow,
    certificateList: Array<Certificate>)
    : Promise<ICertSelectionPromptResults> {

    let certSelectionButtons = new Array<string>();
    let importCertsResponse = -1;

    if (Array.isArray(certificateList)) {
        certificateList.forEach(certificate => certSelectionButtons.push(certificate.subjectName + "\r\nIssuer: " + certificate.issuerName + "\r\nThumbprint: " + certificate.fingerprint));
    }

    if (env.platform === Platform.Linux) {
        importCertsResponse = certSelectionButtons.push("Import more certificates ...") - 1;
    }

    const prompt =
        await moduleManager.getComponentAsync(
            "prompt.select-certificate",
            window.id,
            certificateList);

    const promptResults = await prompt.openAsync();
    const results: ICertSelectionPromptResults = {
        selectedCert: null,
        certsImported: false
    };

    if (!utils.isNullOrUndefined(promptResults)) {
        if (promptResults.selectedCertificate) {
            results.selectedCert = promptResults.selectedCertificate;
        } else {
            results.certsImported = promptResults.certificatesImported;
        }
    }

    return results;
}

interface ICertHandlingRecord {
    handling: boolean;
    callbacks: Array<(cert: Certificate) => void>;
}

function handleGenerally(moduleManager: IModuleManager, window: BrowserWindow): void {
    let clientCertManager: IDictionary<ICertHandlingRecord> = {};

    window.webContents.on("select-client-certificate",
        async (event, urlString, certificateList, selectCertificate) => {
            event.preventDefault();

            let certIdentifier: string = url.parse(urlString).hostname;

            if (certIdentifier in clientCertManager && clientCertManager[certIdentifier].handling) {
                clientCertManager[certIdentifier].callbacks.push(selectCertificate);
            } else {
                let certHandlingRecord = clientCertManager[certIdentifier];

                if (utils.isNullOrUndefined(certHandlingRecord)) {
                    certHandlingRecord = {
                        handling: true,
                        callbacks: []
                    };

                    clientCertManager[certIdentifier] = certHandlingRecord;
                } else {
                    certHandlingRecord.handling = true;
                }

                certHandlingRecord.callbacks.push(selectCertificate);

                const results = await showCertSelectPromptAsync(
                    moduleManager,
                    window,
                    certificateList);

                if (results.selectedCert) {
                    certHandlingRecord.callbacks.forEach((selectCertificateFunc) => selectCertificateFunc(results.selectedCert));
                    delete clientCertManager[certIdentifier];
                } else if (results.certsImported) {
                    certHandlingRecord.handling = false;
                    window.reload();
                } else {
                    electron.app.exit();
                }
            }
        });
}

function handleLinux(): void {
    // Because it is possible that there is no cert in the chromium cert store.
    // Add a dummy cert to the store first, which can ensure that event "select-client-certificate" fires correctly.

    let dummyCertData = new Buffer(require(local("./dummycert.json")).data, "base64");
    let dummayCertFile = tmp.fileSync();

    fs.writeFileSync(dummayCertFile.fd, dummyCertData);
    electron.app.importCertificate(
        {
            certificate: dummayCertFile.name,
            password: "123456"
        },
        (result) => dummayCertFile.removeCallback());
}

export function handle(moduleManager: IModuleManager, window: BrowserWindow): void {
    if (env.platform === Platform.Linux) {
        handleLinux();
    }

    handleGenerally(moduleManager, window);
}
