/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */

const NOTES_COLUMN = 5;

let wordList = localStorage['wordlist'];
let showZhuyin = (localStorage['zhuyin'] === 'yes');

let entries;
if (wordList) {
    entries = JSON.parse(wordList);
    entries.forEach(e => { e.notes = (e.notes || '<i>Edit</i>');});
} else {
    entries = [];
}

function showListIsEmptyNotice() {
    if (entries.length === 0) {
        $('#nodata').show();
    } else {
        $('#nodata').hide();
    }
}

function disableButtons() {
    if (entries.length === 0) {
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

$(document).ready(function () {

    showListIsEmptyNotice();
    disableButtons();

    let missingZhuyinText = '<span class="zw-tooltip">Missing data' +
        '<span class="tooltiptext">Zhuyin data is missing.<br/>Please re-add this entry.</span></span>';

    let wordsElement = $('#words');
    let invalidateRow;
    let table = wordsElement.DataTable({
        data: entries,
        columns: [
            { data: 'simplified' },
            { data: 'traditional' },
            { data: 'pinyin' },
            { data: 'zhuyin', defaultContent: missingZhuyinText, visible: showZhuyin },
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
        localStorage['wordlist'] = JSON.stringify(entries);
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

        let toKeep = [];
        for (let i = 0; i < entries.length; i++) {
            toKeep.push(entries[i]);
        }

        localStorage['wordlist'] = JSON.stringify(toKeep);

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
