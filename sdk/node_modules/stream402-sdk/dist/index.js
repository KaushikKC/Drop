"use strict";
/**
 * Stream402 SDK
 *
 * A TypeScript SDK for integrating Stream402 payment protocol into your applications.
 *
 * @packageDocumentation
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadAsset = exports.payAndFetch = exports.discover = void 0;
var discover_1 = require("./discover");
Object.defineProperty(exports, "discover", { enumerable: true, get: function () { return discover_1.discover; } });
var payAndFetch_1 = require("./payAndFetch");
Object.defineProperty(exports, "payAndFetch", { enumerable: true, get: function () { return payAndFetch_1.payAndFetch; } });
var uploadAsset_1 = require("./uploadAsset");
Object.defineProperty(exports, "uploadAsset", { enumerable: true, get: function () { return uploadAsset_1.uploadAsset; } });
__exportStar(require("./types"), exports);
