// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0
// The browser adapters of the presentation ports — what the components use
// when no <CoreHostProvider> overrides them.
export { browserUrlState } from "./urlState.ts";
export { browserClipboard } from "./clipboard.ts";
export { browserFileSaver } from "./fileSaver.ts";
export { browserEnvironment } from "./environment.ts";
