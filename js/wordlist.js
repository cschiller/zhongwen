/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

/* global globalThis */

'use strict';

const NOTES_COLUMN = 6;

let wordList;

let showZhuyin;

let entries;

// migration from manifest v2
chrome.storage.local.get(['wordList', '_wl_migrated'], data => {
    if (!data._wl_migrated) {

        let v2wordlist = localStorage['wordlist'];
        let migrated = v2wordlist ? JSON.parse(v2wordlist) : [];

        if (data.wordList) {
            migrated.push(...data.wordList);
        }
        chrome.storage.local.set({wordList: migrated, _wl_migrated: true}, () => console.log('wordlist migrated'));
    }
});

chrome.storage.local.get(['wordList', 'zhuyin'], data => {
    wordList = data.wordList;
    showZhuyin = data.zhuyin || globalThis.defaultConfig.zhuyin;

    if (wordList) {
        entries = wordList;
        entries.forEach(e => {
            e.timestamp = e.timestamp || 0;
            e.notes = (e.notes || '<i>Edit</i>');
            e.zhuyin = convert2Zhuyin(e.pinyin);
        });
        // show new entries first
        entries.sort((e1, e2) => e2.timestamp - e1.timestamp);
        entries.forEach((e, i) => e.id = i);
    } else {
        entries = [];
    }
});


function showListIsEmptyNotice() {
    if (!entries || entries.length === 0) {
        $('#nodata').show();
    } else {
        $('#nodata').hide();
    }
}

function disableButtons() {
    if (!entries || entries.length === 0) {
        $('#saveList').prop('disabled', true);
        $('#selectAll').prop('disabled', true);
        $('#deselectAll').prop('disabled', true);
        $('#delete').prop('disabled', true);
    } else {
        $('#saveList').prop('disabled', false);
        $('#selectAll').prop('disabled', false);
        $('#deselectAll').prop('disabled', false);
        $('#delete').prop('disabled', false);
    }
}

function convert2Zhuyin(pinyin) {
    let zhuyin = [];
    let a = pinyin.split(/[\s·]+/);
    for (let i = 0; i < a.length; i++) {
        let syllable = a[i];
        zhuyin.push(globalThis.accentedPinyin2Zhuyin(syllable));
    }
    return zhuyin.join(' ');
}

function copyEntriesForSaving(entries) {
    let result = [];
    for (let i = 0; i < entries.length; i++) {
        result.push(copyEntryForSaving(entries[i]));
    }
    return result;
}

function copyEntryForSaving(entry) {
    let result = Object.assign({}, entry);
    // don't save these atributes
    delete result.id;
    delete result.zhuyin;
    if (result.notes === '<i>Edit</i>') {
        delete result.notes;
    }
    return result;
}

$(document).ready(function () {

    showListIsEmptyNotice();
    disableButtons();

    let wordsElement = $('#words');
    let invalidateRow;
    let table = wordsElement.DataTable({
        data: entries,
        columns: [
            { data: 'id' },
            { data: 'simplified' },
            { data: 'traditional' },
            { data: 'pinyin' },
            { data: 'zhuyin', visible: showZhuyin },
            { data: 'definition' },
            { data: 'notes' },
        ]
    });

    wordsElement.find('tbody').on('click', 'tr', function (event) {
        if (!event.target._DT_CellIndex || event.target._DT_CellIndex.column === NOTES_COLUMN) {
            let index = event.currentTarget._DT_RowIndex;
            let entry = entries[index];

            $('#simplified').val(entry.simplified);
            $('#traditional').val(entry.traditional);
            $('#definition').val(entry.definition);
            $('#notes').val(entry.notes === '<i>Edit</i>' ? '' : entry.notes);
            $('#rowIndex').val(index);

            $('#editNotes').modal('show');
            $('#notes').focus();

            invalidateRow = table.row(this).invalidate;

        } else {
            $(this).toggleClass('bg-info');
        }
    });

    $('#editNotes').on('shown.bs.modal', () => $('#notes').focus());

    $('#saveNotes').click(() => {
        let entry = entries[$('#rowIndex').val()];

        entry.notes = $('#notes').val() || '<i>Edit</i>';

        $('#editNotes').modal('hide');
        invalidateRow().draw();
        chrome.storage.local.set({wordList: copyEntriesForSaving(entries)});
    });

    $('#saveList').click(function () {
        let selected = table.rows('.bg-info').data();

        if (selected.length === 0) {
            return;
        }

        let content = '';
        for (let i = 0; i < selected.length; i++) {
            let entry = selected[i];
            content += entry.simplified;
            content += '\t';
            content += entry.traditional;
            content += '\t';
            content += entry.pinyin;
            content += '\t';
            if (showZhuyin) {
                content += entry.zhuyin;
                content += '\t';
            }
            content += entry.definition;
            content += '\t';
            content += entry.notes.replace('<i>Edit</i>', '').replace(/[\r\n]/gm, ' ');
            content += '\r\n';
        }

        let saveBlob = new Blob([content], { "type": "text/plain" });
        let a = document.getElementById('savelink');
        // Handle Chrome and Firefox
        a.href = (window.webkitURL || window.URL).createObjectURL(saveBlob);
        a.click();
    });

    $('#delete').click(function () {
        table.rows('.bg-info').remove();

        entries = table.rows().data().draw(true);

        chrome.storage.local.set({wordList: copyEntriesForSaving(entries)});

        showListIsEmptyNotice();
        disableButtons();
    });

    $('#selectAll').click(function () {
        $('#words').find('tbody tr').addClass('bg-info');
    });

    $('#deselectAll').click(function () {
        $('#words').find('tbody tr').removeClass('bg-info');
    });
});
