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

function createWordListEntryId() {
    if (globalThis.crypto && globalThis.crypto.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

globalThis.ensureWordListEntryIds = function (wordList, createId = createWordListEntryId) {
    let changed = false;
    let entries = wordList.map(entry => {
        if (entry.entryId) {
            return entry;
        }

        changed = true;
        return {...entry, entryId: createId()};
    });

    return {entries, changed};
};

globalThis.appendWordListEntries = function (
    wordList,
    entries,
    saveMode,
    timestamp = Date.now(),
    createId = createWordListEntryId
) {
    let updated = [...wordList];
    let entriesToSave = saveMode === 'firstEntryOnly' ? entries.slice(0, 1) : entries;

    entriesToSave.forEach(entry => {
        updated.push({
            entryId: createId(),
            timestamp,
            simplified: entry.simplified,
            traditional: entry.traditional,
            pinyin: entry.pinyin,
            definition: entry.definition
        });
    });

    return updated;
};

globalThis.updateWordListEntryNotes = function (wordList, entryId, notes) {
    return wordList.map(entry => {
        if (entry.entryId !== entryId) {
            return entry;
        }

        let updated = {...entry};
        if (notes) {
            updated.notes = notes;
        } else {
            delete updated.notes;
        }
        return updated;
    });
};

globalThis.deleteWordListEntries = function (wordList, entryIds) {
    let ids = new Set(entryIds);
    return wordList.filter(entry => !ids.has(entry.entryId));
};
