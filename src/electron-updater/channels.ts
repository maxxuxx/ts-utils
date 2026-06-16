import { DEFAULT_UPDATER_CHANNELS } from "./constants.js";
import type { UpdaterChannelOptions, UpdaterChannels } from "./types.js";

/** Resolves updater channels */
export const resolveUpdaterChannels = (
  channels: UpdaterChannelOptions = {}
): UpdaterChannels => Object.freeze({
  ...DEFAULT_UPDATER_CHANNELS,
  ...channels
});
