/*
 Zhongwen - A Chinese-English Pop-Up Dictionary
 Copyright (C) 2010-2019 Christian Schiller
 https://chrome.google.com/extensions/detail/kkmlkkjojmombglmlpbpapmhcaljjkde
 */
const utones = {
    1: '\u0304',
    2: '\u0301',
    3: '\u030C',
    4: '\u0300',
    5: ''
};

const NOTES_COLUMN = 5;

let wordList = localStorage['wordlist'];
let showZhuyin = (localStorage['zhuyin'] === 'yes');

let entries;
if (wordList) {
    entries = JSON.parse(wordList);
    let missingZhuyin = false;
    entries.forEach(e => { 
        e.notes = (e.notes || '<i>Edit</i>');

        if (!e.zhuyin) {
            missingZhuyin = true;
            let pinyin = e.pinyin.split(/[\s·]+/);
            let syllables = [];
            /* search for tones */
            pinyin.forEach(py => {
                py = py.toLowerCase();
                let tone = getToneNumber(py);
                let syllable = removeToneMarker(py, tone) + tone;
                syllables.push(syllable);
            });

            let zhuyin = syllables.reduce((zhuyin, syllable) => zhuyin + mapToZhuyin(syllable) + ' ', '').trimEnd();
            e.zhuyin = zhuyin;
        }
    });

} else {
    entries = [];
}

function getToneNumber(pinyin) {
    for (let i = 1; i < 5; i++) {
        if (pinyin.includes(utones[i])) return i;
    }

    return 5;
}

function removeToneMarker(pinyin, tone) {
    let toneIndex = pinyin.indexOf(utones[tone]);
    return pinyin.substring(0, toneIndex) + pinyin.substring(toneIndex + 1);
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

    let wordsElement = $('#words');
    let invalidateRow;
    let table = wordsElement.DataTable({
        data: entries,
        columns: [
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
