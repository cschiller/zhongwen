/* eslint-env node */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function loadHelpers(...files) {
    let context = {};
    context.globalThis = context;
    vm.createContext(context);
    files.forEach(file => {
        let source = fs.readFileSync(path.join(root, file), 'utf8');
        vm.runInContext(source, context, {filename: file});
    });
    return context;
}

test('stored configuration accepts only known configuration keys', () => {
    let helpers = loadHelpers('js/config.js');
    let config = {...helpers.defaultConfig};

    helpers.applyStoredConfig(config, {
        background: 'blue',
        fontSize: 'large',
        wordList: [{simplified: '中文'}]
    });

    assert.equal(config.background, 'blue');
    assert.equal(config.fontSize, 'large');
    assert.equal(config.wordList, undefined);
});

test('legacy MV2 settings and word list convert to typed MV3 storage', () => {
    let helpers = loadHelpers('js/migration.js');
    let wordList = [{simplified: '中文', traditional: '中文'}];

    let migrated = helpers.convertLegacyStorage({
        enabled: '1',
        popupcolor: 'black',
        fontSize: 'large',
        grammar: 'no',
        skritterTLD: 'cn',
        saveToWordList: 'allEntries',
        simpTrad: 'auto',
        tonecolors: 'no',
        toneColorScheme: 'pleco',
        vocab: 'yes',
        zhuyin: 'yes',
        wordlist: JSON.stringify(wordList)
    });

    assert.deepEqual(JSON.parse(JSON.stringify(migrated)), {
        isActive: true,
        background: 'black',
        fontSize: 'large',
        grammar: false,
        skritterTLD: 'cn',
        saveToWordList: 'allEntries',
        simpTrad: 'auto',
        toneColors: false,
        toneColorScheme: 'pleco',
        vocab: true,
        zhuyin: true,
        wordList
    });
});

test('legacy and current word lists merge once without overwriting current settings', () => {
    let helpers = loadHelpers('js/migration.js');
    let oldEntry = {simplified: '旧'};
    let newEntry = {simplified: '新'};
    let updates = helpers.mergeMigratedStorage(
        {wordList: [newEntry], background: 'black'},
        {wordList: [oldEntry], background: 'blue', isActive: true}
    );

    assert.deepEqual(JSON.parse(JSON.stringify(updates.wordList)), [oldEntry, newEntry]);
    assert.equal(updates.background, undefined);
    assert.equal(updates.isActive, true);
    assert.equal(updates._localStorageMigrated, true);
    assert.equal(updates._wl_migrated, true);

    let alreadyMigrated = helpers.mergeMigratedStorage(
        {wordList: [oldEntry, newEntry], _wl_migrated: true},
        {wordList: [oldEntry]}
    );
    assert.equal(alreadyMigrated.wordList, undefined);
});

test('malformed legacy word-list data is not overwritten', () => {
    let helpers = loadHelpers('js/migration.js');
    let migrated = helpers.convertLegacyStorage({wordlist: '{not json'});

    assert.equal(migrated.wordList, undefined);
});

test('word-list helpers preserve prior entries and honor the save mode', () => {
    let helpers = loadHelpers('js/migration.js');
    let existing = [{simplified: '旧'}];
    let incoming = [
        {simplified: '中', traditional: '中', pinyin: 'zhōng', definition: 'middle'},
        {simplified: '文', traditional: '文', pinyin: 'wén', definition: 'writing'}
    ];

    let firstOnly = helpers.appendWordListEntries(existing, incoming, 'firstEntryOnly', 123);
    let allEntries = helpers.appendWordListEntries(existing, incoming, 'allEntries', 456);

    assert.equal(existing.length, 1);
    assert.equal(firstOnly.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(firstOnly[1])), {
        timestamp: 123,
        simplified: '中',
        traditional: '中',
        pinyin: 'zhōng',
        definition: 'middle'
    });
    assert.equal(allEntries.length, 3);
    assert.equal(allEntries[2].timestamp, 456);
});

test('the default word-list mode preserves the MV2 all-entries behavior', () => {
    let helpers = loadHelpers('js/config.js', 'js/migration.js');
    let incoming = [
        {simplified: '中', traditional: '中', pinyin: 'zhōng', definition: 'middle'},
        {simplified: '文', traditional: '文', pinyin: 'wén', definition: 'writing'}
    ];

    let saved = helpers.appendWordListEntries([], incoming, helpers.defaultConfig.saveToWordList, 123);
    assert.equal(helpers.defaultConfig.saveToWordList, 'allEntries');
    assert.equal(saved.length, 2);
});

test('Google Docs separators are removed for lookup and retained for highlighting', async () => {
    let helpers = loadHelpers('js/text.js');
    let originalText = '中\u200c文';
    let normalizedText = helpers.normalizeSearchText(originalText);

    assert.equal(normalizedText, '中文');
    assert.equal(helpers.getHighlightLength(originalText, 2), 3);

    let dictSource = fs.readFileSync(path.join(root, 'dict.js'), 'utf8');
    let dictionaryModule = await import(`data:text/javascript;base64,${Buffer.from(dictSource).toString('base64')}`);
    let dictionary = new dictionaryModule.ZhongwenDictionary(
        fs.readFileSync(path.join(root, 'data/cedict_ts.u8'), 'utf8'),
        fs.readFileSync(path.join(root, 'data/cedict.idx'), 'utf8'),
        JSON.parse(fs.readFileSync(path.join(root, 'data/grammarKeywordsMin.json'), 'utf8')),
        JSON.parse(fs.readFileSync(path.join(root, 'data/vocabularyKeywordsMin.json'), 'utf8'))
    );

    let result = dictionary.wordSearch(normalizedText);
    assert.equal(result.matchLen, 2);
    assert.equal(result.data[0][1], '中文');
});

test('stale asynchronous search responses are ignored', () => {
    let context = loadHelpers('js/config.js', 'js/text.js');
    context.chrome = {
        runtime: {onMessage: {addListener() {}}},
        storage: {
            local: {get(keys, callback) { callback({}); }},
            onChanged: {addListener() {}}
        }
    };

    let contentSource = fs.readFileSync(path.join(root, 'content.js'), 'utf8');
    vm.runInContext(contentSource, context, {filename: 'content.js'});
    vm.runInContext(`
        searchSequence = 2;
        showPopup = () => { globalThis.popupShown = true; };
        processSearchResult({matchLen: 1, originalText: '中'}, 1);
    `, context);

    assert.equal(context.popupShown, undefined);
});

test('Zhuyin conversion accepts precomposed accented Pinyin', () => {
    let helpers = loadHelpers('js/zhuyin.js');

    assert.equal(helpers.accentedPinyin2Zhuyin('zhōng'), 'ㄓㄨㄥ');
    assert.equal(helpers.accentedPinyin2Zhuyin('wén'), 'ㄨㄣˊ');
});
