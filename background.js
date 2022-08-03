/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
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

'use strict';

import { ZhongwenDictionary } from './dict.js';

let isActivated = false;

let dict;

function activateExtension(tabId, showHelp) {

    isActivated = true;

    chrome.storage.local.set({autoActivateExtension: true});

    if (!dict) {
        loadDictionary().then(r => dict = r);
    }

    chrome.tabs.sendMessage(tabId, {
        'type': 'enable'
    });

    if (showHelp) {
        chrome.tabs.sendMessage(tabId, {
            'type': 'showHelp'
        });
    }

    chrome.action.setBadgeBackgroundColor({
        'color': [255, 0, 0, 255]
    });

    chrome.action.setBadgeText({
        'text': 'On'
    });

    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create(
            {
                id: 'wordlistMenuItem',
                title: 'Open word list'
            }
        );

        chrome.contextMenus.create(
            {
                id: 'helpMenuItem',
                title: 'Show help in new tab'
            }
        );

        chrome.contextMenus.onClicked.addListener(({menuItemId}) => {

            chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
                if (menuItemId === 'wordlistMenuItem') {
                    let url = '/wordlist.html';
                    let tabID = tabIDs['wordlist'];
                    if (tabID) {
                        chrome.tabs.get(tabID, function (tab) {
                            if (tab && tab.url && (tab.url.endsWith('wordlist.html'))) {
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
        });

        chrome.contextMenus.onClicked.addListener(({menuItemId}) => {

            chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
                if (menuItemId === 'helpMenuItem') {
                    let url = '/help.html';
                    let tabID = tabIDs['help'];
                    if (tabID) {
                        chrome.tabs.get(tabID, function (tab) {
                            if (tab && (tab.url.endsWith('help.html'))) {
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
        });
    });
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


async function loadDictionary() {
    let [wordDict, wordIndex, grammarKeywords, vocabKeywords] = await loadDictData();
    return new ZhongwenDictionary(wordDict, wordIndex, grammarKeywords, vocabKeywords);
}

function deactivateExtension() {

    isActivated = false;

    chrome.storage.local.set({autoActivateExtension: false});

    dict = undefined;

    chrome.action.setBadgeBackgroundColor({
        'color': [0, 0, 0, 0]
    });

    chrome.action.setBadgeText({
        'text': ''
    });

    // Send a disable message to all tabs in all windows.
    chrome.windows.getAll(
        { 'populate': true },
        function (windows) {
            for (let i = 0; i < windows.length; ++i) {
                let tabs = windows[i].tabs;
                for (let j = 0; j < tabs.length; ++j) {
                    chrome.tabs.sendMessage(tabs[j].id, {
                        'type': 'disable'
                    });
                }
            }
        }
    );

    chrome.contextMenus.removeAll();
}

function activateExtensionToggle(currentTab) {
    chrome.storage.local.get('autoActivateExtension', ({autoActivateExtension}) => {
        autoActivateExtension ? deactivateExtension() : activateExtension(currentTab.id, true);
    });
}

function enableTab(tabId) {

    chrome.storage.local.get('autoActivateExtension', ({autoActivateExtension}) => {
        if (autoActivateExtension) {
            if (!isActivated) {
                activateExtension(tabId, false);
            }
        }
    });

    if (isActivated) {
        chrome.tabs.sendMessage(tabId, {
            'type': 'enable',
        });
    }
}

function search(text) {

    if (!dict) {
        // dictionary not loaded
        return;
    }

    let entry = dict.wordSearch(text);

    if (entry) {
        for (let i = 0; i < entry.data.length; i++) {
            let word = entry.data[i][1];
            if (dict.hasGrammarKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.grammar = { keyword: word, index: i };
            }
            if (dict.hasVocabKeyword(word) && (entry.matchLen === word.length)) {
                // the final index should be the last one with the maximum length
                entry.vocab = { keyword: word, index: i };
            }
        }
    }

    return entry;
}

chrome.action.onClicked.addListener(activateExtensionToggle);

chrome.tabs.onActivated.addListener(activeInfo => {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (activeInfo.tabId === tabIDs['wordlist']) {
            chrome.tabs.reload(activeInfo.tabId);
        } else if (activeInfo.tabId !== tabIDs['help']) {
            enableTab(activeInfo.tabId);
        }
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {

    chrome.storage.session.get('tabIDs', ({tabIDs = {}}) => {
        if (changeInfo.status === 'complete' && tabId !== tabIDs['help'] && tabId !== tabIDs['wordlist']) {
            enableTab(tabId);
        }
    });
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

    if (message.type === 'search') {

        let response = search(message.text);

        sendResponse(response);

        return true;
    }
});

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

chrome.runtime.onMessage.addListener(function (message) {

    if (message.type === 'copy') {
        let txt = document.createElement('textarea');
        txt.style.position = "absolute";
        txt.style.left = "-100%";
        txt.value = message.data;
        document.body.appendChild(txt);
        txt.select();
        document.execCommand('copy');
        document.body.removeChild(txt);
    }
});

chrome.runtime.onMessage.addListener(function (message) {

    if (message.type === 'add') {
        chrome.storage.local.get(['wordlist', 'saveToWordList'], data => {

            let wordlistJson = data.wordlist;

            let wordlist;
            if (wordlistJson) {
                wordlist = JSON.parse(wordlistJson);
            } else {
                wordlist = [];
            }

            for (let i in message.entries) {

                let entry = {};
                entry.timestamp = Date.now();
                entry.simplified = message.entries[i].simplified;
                entry.traditional = message.entries[i].traditional;
                entry.pinyin = message.entries[i].pinyin;
                entry.definition = message.entries[i].definition;

                wordlist.push(entry);

                if (data.saveToWordList === 'firstEntryOnly') {
                    break;
                }
            }

            chrome.storage.local.set({wordlist: JSON.stringify(wordlist)});
        });
    }
});

