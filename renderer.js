const electron = require('electron');
const { ipcRenderer } = electron;
const dialog = electron.remote.dialog;
const $ = jQuery = require('jquery');
require('jquery-ui-dist/jquery-ui');
const fs = require('fs');
const path = require('path');

var os = require('os');
var pty = require('node-pty');
var Terminal = require('xterm').Terminal;
var tabs = $("#file-tabs").tabs();
var tabList = [];

ipcRenderer.on('create-new-file', () => { createNewFileOrFolder(true); })
.on('create-new-folder', () => { createNewFileOrFolder(false); })
.on('open-file', () => { })
.on('open-folder', () => { })
.on('save-file', () => { })

const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
const ptyProcess = pty.spawn(shell, [], {
  name: 'xterm-color',
  cols: 80,
  rows: 30,
  cwd: process.cwd(),
  env: process.env
});

const xterm = new Terminal({rows: 19});

xterm.setOption('theme', { 'background' : 'rgb(1, 22, 39)' });
xterm.open(document.getElementById('terminal'));

xterm.onData(data => ptyProcess.write(data));
ptyProcess.on('data', function(data) {
  xterm.write(data);
});

$(document).ready(async function() {
    var currPath = process.cwd();
    var data = [];
    var baseObj = {
        id: currPath,
        parent: '#',
        icon: './icons/folder/folder-open.svg',
        text: path.basename(currPath)
    }

    var children = getCurrentDirectories(currPath);
    data = data.concat(children);
    data.push(baseObj);

    $('#jstree').jstree({
        "core": {
            "dblclick_toggle" : false,
            "check_callback": true,
            "data": data,
            "themes": { "dots": false }
        }
    })
    .on('ready.jstree', function(e) {
        $('#jstree').jstree(true).open_node(currPath);
    })
    .on('open_node.jstree', function(e, data) {
        if(fs.lstatSync(data.node.id).isDirectory()) {
            data.instance.set_icon(data.node, './icons/folder/folder-open.svg');
        }

        data.node.children.forEach(function(child) {
            var childDirectories = getCurrentDirectories(child);

            childDirectories.forEach(function(directory) {
                if($('#jstree').jstree(true).get_node(directory)) {
                    return;
                }
        
                $('#jstree').jstree().create_node(child, directory);
            })
        })
    })
    .on('close_node.jstree', function(e, data) {
        if(fs.lstatSync(data.node.id).isDirectory()) {
            data.instance.set_icon(data.node, './icons/folder/folder-close.svg');
        }
    })
    .on('select_node.jstree', function(e, data) {
        $('#jstree').jstree(true).get_node(data.node.id, true).children('.jstree-anchor').focus();
        openFileTab(path.basename(currPath), data.node.id, data.node.icon);
        updateEditor(data.node.id, editor);
    })
    .on('click', '.jstree-anchor', function(e) {
        $('#jstree').jstree(true).toggle_node(e.target);
    })
    .on('input.jstree', '.jstree-rename-input', function(event) {
        var currPath = process.cwd();
        var value = event.target.value;
        var input = '.jstree-rename-input';
        var id = path.join(currPath, value);
        var li = $(input).parent().parent().attr('id');
        var node = $('#jstree').jstree().get_node(id);
        var width = parseInt($(input).width());
        var iconWidth;
        
        if(node) {
            iconWidth = parseInt($('#jstree').jstree()
                        .get_node(id, true)
                        .find('i.jstree-themeicon-custom').width());
        }
        
        if(node && value) {
            $(input).css({'border': '1px solid red', 'border-bottom': 'none'});
            $(input).parent()
                    .append(`<div class="rename-warning" style="width: ${width + 4}; margin-left: ${iconWidth + 2}px;">
                              A file or folder <strong style="color: white;">${value}</strong> 
                              already exists at this location. Please choose a different name.
                            </div>`)
        } else if(!value) {
            $(input).css({'border': '1px solid red', 'border-bottom': 'none'});
            $(input).parent()
                    .append(`<div class="rename-warning" style="width: ${width + 4}; margin-left: ${iconWidth + 2}px;">
                              A file or folder name must be provided.
                            </div>`)
        } else {
            $(input).css('border', '1px solid white');
            $('.rename-warning').css('display', 'none');
        }

        if(li === '$file') {
            $('#jstree').jstree().set_icon(li, getIcon(currPath, value));
        }
    })

    var editor = await createEditor();

    tabs.on("click", "a.ui-tabs-anchor", function() {
        var panelId = $(this).parent().attr('aria-controls');
        $(this).focus();
        updateEditor(panelId, editor);

        var selected = $('#jstree').jstree('get_selected');
        if(selected[0] !== panelId) {
            $('#jstree').jstree().deselect_node(selected[0]);
            $('#jstree').jstree().select_node(panelId);
        }
    })
    .on( "click", "span.ui-icon-close-custom", function() {
        var panelId = $(this).closest("li").remove().attr("aria-controls");
        tabs.tabs("refresh");
        tabList = tabList.filter(tab => { return (tab !== panelId) });
        $('a[href="' + "#" + tabList[tabList.length - 1] + '"]').click();
    });
})

function getIcon(currPath, file) {
    var icon = './icons/dev/file.svg';
    var id = path.join(currPath, file);
    
    if(file && fs.existsSync(id) && fs.lstatSync(id).isDirectory()) {
        icon = './icons/folder/folder-close.svg';
    } else {
        var ext = file.split('.')[1];
    
        if(['cpp', 'cs', 'css', 'html', 'java', 'js', 'json', 'md', 'py', 'rb', 'sh', 'svg', 'ts', 'ttf', 'txt', 'xml'].includes(ext)) {
            icon = `./icons/dev/${ext}.svg`;
        } else {
            if(file.toLowerCase().includes('license')) {
                icon = './icons/dev/certificate.svg';
            } else if(file.toLowerCase().includes('readme')) {
                icon = './icons/dev/readme.svg';
            } else if(file.toLowerCase().includes('changelog')) {
                icon = './icons/dev/changelog.svg'
            }
        }
    }

    return icon;
}

function getCurrentDirectories(currPath) {
    if(fs.lstatSync(currPath).isFile() 
    || fs.lstatSync(currPath).isBlockDevice() 
    || fs.lstatSync(currPath).isSymbolicLink() 
    || fs.lstatSync(currPath).isFIFO()) {
        return [];
    }

    var files = fs.readdirSync(currPath);

    var rv = [];
    for(var i = 0; i < files.length; i++) {
        var file = files[i];
        icon = getIcon(currPath, file);

        rv.push({
            id: path.join(currPath, file),
            parent: currPath,
            text: path.basename(file),
            icon: icon
        })
    }

    return rv;
}

function openFileTab(parent, currPath, icon) {
    if(fs.lstatSync(currPath).isDirectory()) {
        return;
    }

    document.title = path.basename(currPath) + " - " + parent + " - Electra Code";

    if(tabList.includes(currPath)) {
        $('a[href="' + "#" + currPath + '"]').click();
        return;
    }
    
    var label = path.basename(currPath);
    var id = currPath;
    var li = `<li>
                <a href='#${id}' tabIndex=0>${label}
                    <span class='tab-icon' style='background-image: url("${icon}");'></span>
                </a>
                <span class='ui-icon ui-icon-close-custom' role='presentation'>Remove Tab</span>
              </li>`;

    tabs.find(".ui-tabs-nav").append(li);
    tabs.append('<div id="' + id + '"style="display: none;"><p></p></div>');
    tabs.tabs("refresh");
    tabList.push(id);

    $('a[href="' + "#" + id + '"]').click();
}

function createEditor() {
    return new Promise(function(resolve, reject) {
        var monacoLoader = require("monaco-editor/min/vs/loader");
        monacoLoader.require.config({ paths: { 'vs': './node_modules/monaco-editor/min/vs' }});

        monacoLoader.require(['vs/editor/editor.main'], function() {
            fetch('./node_modules/monaco-themes/themes/Night Owl.json')
            .then(data => data.json())
            .then(data => {
                monaco.editor.defineTheme('night-owl', data);
                monaco.editor.setTheme('night-owl');
            })
        
            var editor = monaco.editor.create(document.getElementById('editor'), {
                value: [
                    'function x() {',
                    '\tconsole.log("Hello world!");',
                    '}'
                ].join('\n'),
                language: 'javascript',
            });

            resolve(editor);
        });
    })
}

function updateEditor(currPath, editor) {
    if(fs.lstatSync(currPath).isDirectory()) {
        return;
    }

    var filename = path.basename(currPath);
    var fileExt = filename.split('.')[1];

    if(fileExt == 'js') {
        fileExt = 'javascript';
    }

    var data = fs.readFileSync(currPath).toString();
    editor.setValue(data);

    monaco.editor.setModelLanguage(editor.getModel(), fileExt)
}

function createNewFileOrFolder(isFile) {
    var currPath = process.cwd();
    var parent = $('#jstree').jstree(true).get_node(currPath);
    $('#jstree').jstree(true).open_node(parent);
    
    var id = '$file', icon = './icons/dev/file.svg';
    if(!isFile) {
        id = "$folder"
        icon = './icons/folder/folder-close.svg';
    }

    $("#jstree").jstree().create_node(parent, { id : id, parent: currPath, icon: icon }, "last", function(node) {
        this.deselect_all();
        this.edit(node, '', function(node, status, cancelled) {
            if (!node.text || !status || cancelled) {
                this.delete_node(node);
            } else {
                var id = path.join(node.parent, node.text);
                if(this.get_node(id)) {
                    this.delete_node(node);
                } else {
                    isFile? fs.writeFileSync(id, '') : fs.mkdirSync(id);
                    this.set_id(node, id);
                    this.select_node(node);
                }
            }
        });
    });
}