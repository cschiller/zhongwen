/* global globalThis */

'use strict';

const legacyConfigMappings = {
    popupcolor: ['background', value => value],
    fontSize: ['fontSize', value => value],
    grammar: ['grammar', value => value !== 'no'],
    skritterTLD: ['skritterTLD', value => value],
    saveToWordList: ['saveToWordList', value => value],
    simpTrad: ['simpTrad', value => value],
    tonecolors: ['toneColors', value => value !== 'no'],
    toneColorScheme: ['toneColorScheme', value => value],
    vocab: ['vocab', value => value !== 'no'],
    zhuyin: ['zhuyin', value => value === 'yes']
};

globalThis.convertLegacyStorage = function (legacyStorage) {
    let migrated = {};

    if (legacyStorage.enabled !== undefined) {
        migrated.isActive = legacyStorage.enabled === '1';
    }

    Object.entries(legacyConfigMappings).forEach(([legacyKey, [currentKey, convert]]) => {
        if (legacyStorage[legacyKey] !== undefined) {
            migrated[currentKey] = convert(legacyStorage[legacyKey]);
        }
    });

    if (legacyStorage.wordlist !== undefined) {
        try {
            let wordList = JSON.parse(legacyStorage.wordlist);
            if (Array.isArray(wordList)) {
                migrated.wordList = wordList;
            }
        } catch (error) {
            // Preserve malformed legacy data in localStorage rather than replacing it.
        }
    }

    return migrated;
};

globalThis.mergeMigratedStorage = function (currentStorage, convertedStorage) {
    let updates = {
        _localStorageMigrated: true,
        _wl_migrated: true
    };

    Object.entries(convertedStorage).forEach(([key, value]) => {
        if (key === 'wordList' && currentStorage.wordList !== undefined) {
            if (!currentStorage._wl_migrated) {
                updates.wordList = [...value, ...currentStorage.wordList];
            }
        } else if (currentStorage[key] === undefined) {
            updates[key] = value;
        }
    });

    return updates;
};

globalThis.appendWordListEntries = function (wordList, entries, saveMode, timestamp = Date.now()) {
    let updated = [...wordList];
    let entriesToSave = saveMode === 'firstEntryOnly' ? entries.slice(0, 1) : entries;

    entriesToSave.forEach(entry => {
        updated.push({
            timestamp,
            simplified: entry.simplified,
            traditional: entry.traditional,
            pinyin: entry.pinyin,
            definition: entry.definition
        });
    });

    return updated;
};
