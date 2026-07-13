/* global globalThis */

globalThis.defaultConfig = {
    background: 'yellow',
    fontSize: 'small',
    grammar: true,
    skritterTLD: 'com',
    saveToWordList: 'firstEntryOnly',
    simpTrad: 'classic',
    toneColors: true,
    toneColorScheme: 'standard',
    vocab: true,
    zhuyin: false
};

globalThis.configKeys = Object.freeze(Object.keys(globalThis.defaultConfig));

globalThis.applyStoredConfig = function (config, storedConfig) {
    globalThis.configKeys.forEach(key => {
        if (storedConfig[key] !== undefined) {
            config[key] = storedConfig[key];
        }
    });
    return config;
};
