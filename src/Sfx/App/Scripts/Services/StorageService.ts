﻿//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

module Sfx {

    export class StorageService extends Observable {

        public getValueNumber(key: string, defaultValue: number): number {
            return this.getValueT<number>(key, (item) => Number(item), defaultValue);
        }

        public getValueString(key: string, defaultValue: string): string {
            return this.getValueT<string>(key, (item) => item, defaultValue);
        }

        public getValueBoolean(key: string, defaultValue: boolean): boolean {
            return this.getValueT<boolean>(key, (item) => item === "true", defaultValue);
        }

        public getValueT<T>(key: string, convert: (item) => T, defaultValue: T): T {
            let value = localStorage.getItem(key);
            if (value) {
                return convert(value);
            }
            return defaultValue;
        }

        public clear(key: string): void {
            if (this.isDefined(key)) {
                localStorage.removeItem(key);
            }
        }

        public isDefined(key: string): boolean {
            return !!localStorage.getItem(key);
        }

        public setValue(key: string, newValue: any) {
            let oldValue = localStorage.getItem(key) || "";
            if (oldValue !== newValue.toString()) {
                localStorage.setItem(key, newValue.toString());
                this.notify(key, oldValue, newValue.toString());
            }
        }
    }

    (function () {

        let module = angular.module("storageService", []);
        module.factory("storage", () => new StorageService());

    })();
}
