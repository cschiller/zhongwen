/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2022 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

/* global globalThis */

'use strict';

const NOTES_COLUMN = 6;

let wordList;

let showZhuyin;

let entries = [];

async function loadWordList() {
    let data = await chrome.runtime.sendMessage({type: 'getWordList'});

    if (!data || !data.success) {
        throw new Error('Unable to load the word list');
    }

    wordList = data.wordList || [];
    showZhuyin = data.zhuyin ?? globalThis.defaultConfig.zhuyin;
    entries = wordList;

    entries.forEach(e => {
        e.timestamp = e.timestamp || 0;
        e.notes = (e.notes || '<i>Edit</i>');
        e.zhuyin = convert2Zhuyin(e.pinyin);
    });
    // show new entries first
    entries.sort((e1, e2) => e2.timestamp - e1.timestamp);
    entries.forEach((e, i) => e.id = i);
}


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

$(document).ready(async function () {

    await loadWordList();

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

    $('#saveNotes').click(async () => {
        let entry = entries[$('#rowIndex').val()];
        let notes = $('#notes').val();
        let response = await chrome.runtime.sendMessage({
            type: 'updateWordListEntry',
            entryId: entry.entryId,
            notes
        });

        if (!response || !response.success) {
            return;
        }

        entry.notes = notes || '<i>Edit</i>';

        $('#editNotes').modal('hide');
        invalidateRow().draw();
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

    $('#delete').click(async function () {
        let selected = table.rows('.bg-info').data();
        let entryIds = [];
        for (let i = 0; i < selected.length; i++) {
            entryIds.push(selected[i].entryId);
        }

        let response = await chrome.runtime.sendMessage({
            type: 'deleteWordListEntries',
            entryIds
        });

        if (!response || !response.success) {
            return;
        }

        table.rows('.bg-info').remove();

        entries = table.rows().data().draw(true);

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
