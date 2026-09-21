import { defineVerifierPlugin } from "./factory"

// V2 local-plugin entrypoint: exactly one default export carrying the
// plugin definition. Nothing else may live in this module.
export default defineVerifierPlugin()
