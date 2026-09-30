/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2023 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde

 ---

 Originally based on Rikaikun 0.8
 Copyright (C) 2010 Erek Speed
 http://code.google.com/p/rikaikun/

 ---

 Originally based on Rikaichan 1.07
 by Jonathan Zarate
 http://www.polarcloud.com/

 ---

 Originally based on RikaiXUL 0.4 by Todd Rudick
 http://www.rikai.com/
 http://rikaixul.mozdev.org/

 ---

 This program is free software; you can redistribute it and/or modify
 it under the terms of the GNU General Public License as published by
 the Free Software Foundation; either version 2 of the License, or
 (at your option) any later version.

 This program is distributed in the hope that it will be useful,
 but WITHOUT ANY WARRANTY; without even the implied warranty of
 MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 GNU General Public License for more details.

 You should have received a copy of the GNU General Public License
 along with this program; if not, write to the Free Software
 Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA

 ---

 Please do not change or remove any of the copyrights or links to web pages
 when modifying any of the files.

 */

/* global globalThis */

'use strict';

import { ZhongwenDictionary } from './dict.js';
import './js/config.js';
import './js/migration.js';

let dict;

let dictionaryPromise;

let dictionaryGeneration = 0;

let creatingOffscreenDocument;

let migrationPromise;

let offscreenTaskQueue = Promise.resolve();

let wordListWriteQueue = Promise.resolve();

let activationQueue = Promise.resolve();

let stateTransition = 0;

const OFFSCREEN_DOCUMENT_PATH = 'offscreen.html';

async function ensureOffscreenDocument() {
    let offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
    let hasDocument;

    if (chrome.runtime.getContexts) {
        let contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });
        hasDocument = contexts.length > 0;
    } else {
        let matchedClients = await globalThis.clients.matchAll();
        hasDocument = matchedClients.some(client => client.url === offscreenUrl);
    }

    if (hasDocument) {
        return;
    }

    if (!creatingOffscreenDocument) {
        creatingOffscreenDocument = chrome.offscreen.createDocument({
            url: OFFSCREEN_DOCUMENT_PATH,
            reasons: ['LOCAL_STORAGE'],
            justification: 'Migrate extension settings from Manifest V2 storage'
        }).finally(() => {
            creatingOffscreenDocument = undefined;
        });
    }

    await creatingOffscreenDocument;
}

function runOffscreenTask(message, closeAfter = false) {
    let task = offscreenTaskQueue.then(async () => {
        await ensureOffscreenDocument();
        try {
            return await chrome.runtime.sendMessage({...message, target: 'offscreen'});
        } finally {
            if (closeAfter) {
                await chrome.offscreen.closeDocument().catch(() => undefined);
            }
        }
    });

    offscreenTaskQueue = task.catch(() => undefined);
    return task;
}

function migrateLegacyStorage() {
    if (!migrationPromise) {
        migrationPromise = performLegacyStorageMigration().catch(error => {
            migrationPromise = undefined;
            throw error;
        });
    }
    return migrationPromise;
}

async function performLegacyStorageMigration() {
    let currentKeys = [
        ...globalThis.configKeys,
        'isActive',
        'wordList',
        '_wl_migrated',
        '_localStorageMigrated'
    ];
    let migrationState = await chrome.storage.local.get('_localStorageMigrated');

    if (migrationState._localStorageMigrated) {
        return false;
    }

    if (!chrome.offscreen) {
        return false;
    }

    let response = await runOffscreenTask({type: 'readLegacyStorage'}, true);
    let legacyStorage = response ? response.legacyStorage : {};
    let convertedStorage = globalThis.convertLegacyStorage(legacyStorage);
    let currentStorage = await chrome.storage.local.get(currentKeys);

    if (currentStorage._localStorageMigrated) {
        return false;
    }

    let updates = globalThis.mergeMigratedStorage(currentStorage, convertedStorage);

    await chrome.storage.local.set(updates);
    return true;
}

async function restoreActiveState() {
    let transition = ++stateTransition;
    let {isActive} = await chrome.storage.local.get('isActive');

    if (transition !== stateTransition) {
        return;
    }

    if (!isActive) {
        showInactiveBadge();
        removeContextMenus();
        return;
    }

    showActiveBadge();
    createContextMenus(transition);
    let tabs = await chrome.tabs.query({});

    if (transition !== stateTransition) {
        return;
    }

    tabs.forEach(tab => enableTab(tab.id));
}

function createContextMenus(transition = stateTransition) {
    chrome.contextMenus.removeAll(() => {
        if (transition !== stateTransition) {
            return;
        }

        chrome.contextMenus.create({
            id: 'wordlistMenuItem',
            title: 'Open word list'
        });
        chrome.contextMenus.create({
            id: 'helpMenuItem',
            title: 'Show help in new tab'
        });
    });
}

function removeContextMenus() {
    chrome.contextMenus.removeAll();
}

chrome.contextMenus.onClicked.addListener(wordlistMenuItemListener);

chrome.contextMenus.onClicked.addListener(helpMenuItemListener);

function wordlistMenuItemListener({menuItemId}) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (menuItemId === 'wordlistMenuItem') {
            let url = '/wordlist.html';
            let tabID = tabIDs['wordlist'];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (!chrome.runtime.lastError && tab && tab.url && (tab.url.endsWith('wordlist.html'))) {
                        chrome.tabs.update(tabID, {
                            active: true
                        });
                    } else {
                        chrome.tabs.create({
                            url: url
                        }, function (tab) {
                            tabIDs['wordlist'] = tab.id;
                            chrome.storage.session.set({tabIDs});
                        });
                    }
                });
            } else {
                chrome.tabs.create(
                    {url: url},
                    function (tab) {
                        tabIDs['wordlist'] = tab.id;
                        chrome.storage.session.set({tabIDs});
                    }
                );
            }
        }
    });
}

function helpMenuItemListener({menuItemId}) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (menuItemId === 'helpMenuItem') {
            let url = '/help.html';
            let tabID = tabIDs['help'];
            if (tabID) {
                chrome.tabs.get(tabID, function (tab) {
                    if (!chrome.runtime.lastError && tab && (tab.url.endsWith('help.html'))) {
                        chrome.tabs.update(tabID, {
                            active: true
                        });
                    } else {
                        chrome.tabs.create({
                            url: url
                        }, function (tab) {
                            tabIDs['help'] = tab.id;
                            chrome.storage.session.set({tabIDs});
                        });
                    }
                });
            } else {
                chrome.tabs.create(
                    {url: url},
                    function (tab) {
                        tabIDs['help'] = tab.id;
                        chrome.storage.session.set({tabIDs});
                    }
                );
            }
        }
    });
}

chrome.action.onClicked.addListener(activateExtensionToggle);

function activateExtensionToggle(currentTab) {
    activationQueue = activationQueue.then(async () => {
        await migrateLegacyStorage().catch(() => false);
        let {isActive} = await chrome.storage.local.get('isActive');
        return isActive ? deactivateExtension() : activateExtension(currentTab.id);
    }).catch(error => console.error('Unable to change Zhongwen activation state', error));
}

async function activateExtension(tabId) {
    let transition = ++stateTransition;

    await chrome.storage.local.set({isActive: true});

    if (transition !== stateTransition) {
        return;
    }

    enableTab(tabId);

    showActiveBadge();

    createContextMenus(transition);

    showHelpMenu(tabId);
}

function enableTab(tabId) {
    chrome.tabs.sendMessage(tabId, {
        'type': 'enable'
    }, () => {
        if (chrome.runtime.lastError) {
            // ignore
        }
    });
}

function showActiveBadge() {
    chrome.action.setBadgeBackgroundColor({
        'color': [255, 0, 0, 255]
    });

    chrome.action.setBadgeText({
        'text': 'On'
    });
}

function showHelpMenu(tabId) {
    chrome.tabs.sendMessage(tabId, {
        'type': 'showHelp'
    }, () => {
        if (chrome.runtime.lastError) {
            // ignore
        }
    });
}

async function deactivateExtension() {
    let transition = ++stateTransition;

    await chrome.storage.local.set({isActive: false});

    dict = undefined;
    dictionaryPromise = undefined;
    ++dictionaryGeneration;

    showInactiveBadge();

    removeContextMenus();

    await disableAllTabs(transition);
}

function showInactiveBadge() {
    chrome.action.setBadgeBackgroundColor({
        'color': [0, 0, 0, 0]
    });

    chrome.action.setBadgeText({
        'text': ''
    });
}

function disableAllTabs(transition = stateTransition) {
    return new Promise(resolve => {
        chrome.windows.getAll(
            { 'populate': true },
            function (windows) {
                if (transition !== stateTransition) {
                    resolve();
                    return;
                }

                for (let i = 0; i < windows.length; ++i) {
                    let tabs = windows[i].tabs;
                    for (let j = 0; j < tabs.length; ++j) {
                        chrome.tabs.sendMessage(tabs[j].id, {
                            'type': 'disable'
                        }, () => {
                            if (chrome.runtime.lastError) {
                                // ignore
                            }
                        });
                    }
                }
                resolve();
            }
        );
    });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (message.type === 'search') {

        search(message.text).then(response => {
            if (response) {
                response.originalText = message.originalText || message.text;
            }
            sendResponse(response);
        }).catch(() => {
            sendResponse(undefined);
        });

        return true;
    }
});

function search(text) {

    if (!dict) {
        if (!dictionaryPromise) {
            let generation = dictionaryGeneration;
            let pending = loadDictionary().then(dictionary => {
                if (generation === dictionaryGeneration) {
                    dict = dictionary;
                }
                return dictionary;
            }).finally(() => {
                if (dictionaryPromise === pending) {
                    dictionaryPromise = undefined;
                }
            });
            dictionaryPromise = pending;
        }

        return dictionaryPromise.then(dictionary => lookup(dictionary, text));
    } else {
        let entry = lookup(dict, text);

        return Promise.resolve(entry);
    }
}

async function loadDictionary() {
    let [wordDict, wordIndex, grammarKeywords, vocabKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords, vocabKeywords);
}

async function loadDictData() {
    let wordDict = fetch(chrome.runtime.getURL(
        "data/cedict_ts.u8")).then(r => r.text());
    let wordIndex = fetch(chrome.runtime.getURL(
        "data/cedict.idx")).then(r => r.text());
    let grammarKeywords = fetch(chrome.runtime.getURL(
        "data/grammarKeywordsMin.json")).then(r => r.json());
    let vocabKeywords = fetch(chrome.runtime.getURL(
        "data/vocabularyKeywordsMin.json")).then(r => r.json());

    return Promise.all([wordDict, wordIndex, grammarKeywords, vocabKeywords]);
}

function lookup(dictionary, text) {

    let entry = dictionary.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dictionary.hasGrammarKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.grammar = { keyword: word, index: i };
            }
            if (dictionary.hasVocabKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.vocab = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

chrome.tabs.onActivated.addListener(activeInfo => {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (activeInfo.tabId === tabIDs['wordlist']) {
            chrome.tabs.reload(activeInfo.tabId);
        } else if (activeInfo.tabId !== tabIDs['help']) {
            enableTabIfActive(activeInfo.tabId);
        }
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (changeInfo.status === 'complete' && tabId !== tabIDs['help'] && tabId !== tabIDs['wordlist']) {
            enableTabIfActive(tabId);
        }
    });
});


function enableTabIfActive(tabId) {
    let transition = stateTransition;

    chrome.storage.local.get('isActive', ({isActive}) => {
        if (isActive && transition === stateTransition) {
            enableTab(tabId);
            showActiveBadge();
        }
    });
}

chrome.runtime.onMessage.addListener(function (message) {

    if (message.type === 'open') {
        chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
            let tabID = tabIDs[message.tabType];
            if (tabID) {
                chrome.tabs.get(tabID, () => {
                    if (!chrome.runtime.lastError) {
                        // activate existing tab
                        chrome.tabs.update(tabID, {active: true, url: message.url});
                    } else {
                        createTab(message.url, message.tabType);
                    }
                });
            } else {
                createTab(message.url, message.tabType);
            }
        });
    }
});
function createTab(url, tabType) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        chrome.tabs.create({url}, tab => {
            tabIDs[tabType] = tab.id;
            chrome.storage.session.set({tabIDs});
        });
    });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {

    if (message.type === 'add') {
        addWordListEntries(message.entries).then(() => {
            sendResponse({success: true});
        }).catch(() => {
            sendResponse({success: false});
        });

        return true;
    }

    if (message.type === 'getWordList') {
        getWordList().then(data => {
            sendResponse({success: true, ...data});
        }).catch(() => {
            sendResponse({success: false});
        });

        return true;
    }

    if (message.type === 'updateWordListEntry') {
        updateWordListEntry(message.entryId, message.notes).then(updated => {
            sendResponse({success: updated});
        }).catch(() => {
            sendResponse({success: false});
        });

        return true;
    }

    if (message.type === 'deleteWordListEntries') {
        deleteWordListEntries(message.entryIds).then(() => {
            sendResponse({success: true});
        }).catch(() => {
            sendResponse({success: false});
        });

        return true;
    }
});

function queueWordListOperation(operation) {
    let task = wordListWriteQueue.then(async () => {
        await migrateLegacyStorage().catch(() => false);
        return operation();
    });
    wordListWriteQueue = task.catch(() => undefined);
    return task;
}

async function readWordListWithIds() {
    let data = await chrome.storage.local.get(['wordList', 'saveToWordList', 'zhuyin']);
    let normalized = globalThis.ensureWordListEntryIds(data.wordList || []);

    if (normalized.changed) {
        await chrome.storage.local.set({wordList: normalized.entries});
    }

    return {...data, wordList: normalized.entries};
}

function getWordList() {
    return queueWordListOperation(async () => {
        let data = await readWordListWithIds();
        return {wordList: data.wordList, zhuyin: data.zhuyin};
    });
}

function addWordListEntries(entries) {
    return queueWordListOperation(async () => {
        let data = await readWordListWithIds();
        let wordList = data.wordList;
        let saveMode = data.saveToWordList || globalThis.defaultConfig.saveToWordList;
        let updatedWordList = globalThis.appendWordListEntries(wordList, entries, saveMode);
        await chrome.storage.local.set({wordList: updatedWordList});
    });
}

function updateWordListEntry(entryId, notes) {
    return queueWordListOperation(async () => {
        let data = await readWordListWithIds();

        if (!data.wordList.some(entry => entry.entryId === entryId)) {
            return false;
        }

        let updatedWordList = globalThis.updateWordListEntryNotes(data.wordList, entryId, notes);
        await chrome.storage.local.set({wordList: updatedWordList});
        return true;
    });
}

function deleteWordListEntries(entryIds) {
    return queueWordListOperation(async () => {
        let data = await readWordListWithIds();
        let updatedWordList = globalThis.deleteWordListEntries(data.wordList, entryIds);
        await chrome.storage.local.set({wordList: updatedWordList});
    });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'migrateLegacyStorage' && message.target !== 'offscreen') {
        migrateLegacyStorage().then(migrated => {
            sendResponse({success: true, migrated});
        }).catch(() => {
            sendResponse({success: false});
        });
        return true;
    }
});

migrateLegacyStorage()
    .catch(error => console.error('Unable to migrate legacy Zhongwen settings', error))
    .then(restoreActiveState)
    .catch(error => console.error('Unable to restore Zhongwen activation state', error));
