const App = (() => {

    let draggingType = null;
    let draggingBlockId = null;
    let dragOverBlockId = null;
    let dragOverPosition = null;

    function init() {
        const initialState = {
            blocks: [],
            selectedId: null
        };

        LayoutManager.init(initialState, {
            onChange: onStateChange,
            onSelect: onSelectChange
        });

        PreviewRenderer.init('#preview-iframe', '#preview-container');

        renderComponentList();
        bindGlobalEvents();
        renderEditor();
        PreviewRenderer.render(initialState.blocks);
    }

    function onStateChange(state) {
        renderEditor();
        PreviewRenderer.render(state.blocks);
        renderProperties();
    }

    function onSelectChange(blockId) {
        renderEditor();
        renderProperties();
    }

    function renderComponentList() {
        const list = document.getElementById('component-list');
        const components = ComponentLibrary.getAllComponents();

        list.innerHTML = components.map(comp => `
            <div class="component-item" draggable="true" data-type="${comp.type}">
                <span class="icon">${comp.icon}</span>
                <span class="label">${comp.label}</span>
            </div>
        `).join('');

        list.querySelectorAll('.component-item').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggingType = item.dataset.type;
                draggingBlockId = null;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('text/plain', draggingType);
            });

            item.addEventListener('dragend', () => {
                draggingType = null;
                draggingBlockId = null;
                clearDragOver();
            });
        });
    }

    function bindGlobalEvents() {
        document.getElementById('btn-view-desktop').addEventListener('click', (e) => {
            setViewToggle('desktop');
        });
        document.getElementById('btn-view-mobile').addEventListener('click', (e) => {
            setViewToggle('mobile');
        });

        document.getElementById('btn-export-html').addEventListener('click', () => {
            IOManager.exportHtml(LayoutManager.getState().blocks);
        });

        document.getElementById('btn-export-json').addEventListener('click', () => {
            IOManager.exportJson(LayoutManager.getState());
        });

        const fileInput = document.getElementById('file-import');
        document.getElementById('btn-import-json').addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            IOManager.importJson(file).then(data => {
                LayoutManager.setState({ blocks: data.blocks, selectedId: null });
            }).catch(err => {
                alert(err.message);
            });
            fileInput.value = '';
        });

        document.getElementById('btn-clear').addEventListener('click', () => {
            if (LayoutManager.getState().blocks.length === 0) return;
            if (confirm('确定要清空所有内容吗？')) {
                LayoutManager.clearAll();
            }
        });

        const canvas = document.getElementById('editor-canvas');

        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = draggingBlockId ? 'move' : 'copy';
            canvas.classList.add('drag-over');
        });

        canvas.addEventListener('dragleave', (e) => {
            if (e.target === canvas) {
                canvas.classList.remove('drag-over');
            }
        });

        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            clearDragOver();

            if (draggingType && !draggingBlockId) {
                const block = ComponentLibrary.createBlock(draggingType);
                LayoutManager.addBlock(block);
            }
        });

        document.addEventListener('click', (e) => {
            const wrapper = e.target.closest('.block-wrapper');
            const column = e.target.closest('.mj-column');
            const actionBtn = e.target.closest('.block-action-btn');
            const properties = e.target.closest('.properties-panel');
            const componentItem = e.target.closest('.component-item');

            if (!wrapper && !column && !properties && !componentItem) {
                LayoutManager.selectBlock(null);
            }
        });
    }

    function setViewToggle(view) {
        PreviewRenderer.setView(view);
        document.querySelectorAll('.btn-toggle').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
    }

    function renderEditor() {
        const canvas = document.getElementById('editor-canvas');
        const state = LayoutManager.getState();

        if (state.blocks.length === 0) {
            canvas.innerHTML = `<div class="empty-hint"><p>👈 从左侧拖拽组件到这里开始编辑</p></div>`;
            return;
        }

        canvas.innerHTML = state.blocks.map((block, index) => {
            const isSelected = block.id === state.selectedId;
            return `
                <div class="block-wrapper ${isSelected ? 'selected' : ''}" 
                     data-block-id="${block.id}" 
                     data-block-index="${index}"
                     draggable="false">
                    <div class="block-drag-handle" draggable="true" title="拖拽排序">⋮⋮</div>
                    <div class="block-actions">
                        <button class="block-action-btn duplicate" title="复制" data-action="duplicate">📋</button>
                        <button class="block-action-btn delete" title="删除" data-action="delete">🗑️</button>
                    </div>
                    <div class="block-content">
                        ${TemplateEngine.renderEditorBlock(block)}
                    </div>
                </div>
            `;
        }).join('');

        bindBlockEvents(canvas);
    }

    function bindBlockEvents(canvas) {
        canvas.querySelectorAll('.block-wrapper').forEach(wrapper => {
            const blockId = wrapper.dataset.blockId;
            const handle = wrapper.querySelector('.block-drag-handle');

            handle.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                draggingType = null;
                draggingBlockId = blockId;
                wrapper.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', blockId);
            });

            handle.addEventListener('dragend', (e) => {
                draggingType = null;
                draggingBlockId = null;
                wrapper.classList.remove('dragging');
                clearDragOver();
            });

            wrapper.addEventListener('dragover', (e) => {
                if (!draggingBlockId && !draggingType) return;
                e.preventDefault();
                e.stopPropagation();

                const rect = wrapper.getBoundingClientRect();
                const midPoint = rect.top + rect.height / 2;
                const position = e.clientY < midPoint ? 'top' : 'bottom';

                if (dragOverBlockId !== blockId || dragOverPosition !== position) {
                    clearDragOver();
                    dragOverBlockId = blockId;
                    dragOverPosition = position;
                    wrapper.classList.add(position === 'top' ? 'drag-over-top' : 'drag-over-bottom');
                }
            });

            wrapper.addEventListener('dragleave', (e) => {
                if (!wrapper.contains(e.relatedTarget)) {
                    wrapper.classList.remove('drag-over-top', 'drag-over-bottom');
                    if (dragOverBlockId === blockId) {
                        dragOverBlockId = null;
                        dragOverPosition = null;
                    }
                }
            });

            wrapper.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                clearDragOver();

                if (draggingType && !draggingBlockId) {
                    const block = ComponentLibrary.createBlock(draggingType);
                    const targetIndex = LayoutManager.getBlockIndex(blockId);
                    const insertIndex = dragOverPosition === 'top' ? targetIndex : targetIndex + 1;
                    LayoutManager.addBlock(block, insertIndex);
                } else if (draggingBlockId && draggingBlockId !== blockId) {
                    const fromIndex = LayoutManager.getBlockIndex(draggingBlockId);
                    const toIndex = LayoutManager.getBlockIndex(blockId);
                    const finalIndex = dragOverPosition === 'top' ? toIndex : toIndex + 1;
                    LayoutManager.moveBlock(fromIndex, finalIndex);
                }
            });

            wrapper.querySelector('.block-content').addEventListener('click', (e) => {
                e.stopPropagation();
                const col = e.target.closest('.mj-column');
                LayoutManager.selectBlock(blockId);
            });

            wrapper.querySelectorAll('.block-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = btn.dataset.action;
                    if (action === 'delete') {
                        if (confirm('确定要删除这个区块吗？')) {
                            LayoutManager.removeBlock(blockId);
                        }
                    } else if (action === 'duplicate') {
                        LayoutManager.duplicateBlock(blockId);
                    }
                });
            });

            const columns = wrapper.querySelectorAll('.mj-column');
            columns.forEach((col, colIdx) => {
                col.addEventListener('click', (e) => {
                    e.stopPropagation();
                    LayoutManager.selectBlock(blockId);
                    const block = LayoutManager.getSelectedBlock();
                    if (block && block.type === 'columns') {
                        renderColumnProperties(block, colIdx);
                    }
                });
            });
        });
    }

    function clearDragOver() {
        document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
            el.classList.remove('drag-over-top', 'drag-over-bottom');
        });
        dragOverBlockId = null;
        dragOverPosition = null;
    }

    function renderProperties() {
        const container = document.getElementById('properties-content');
        const block = LayoutManager.getSelectedBlock();

        if (!block) {
            container.innerHTML = '<p class="empty-hint">点击组件编辑属性</p>';
            return;
        }

        const comp = ComponentLibrary.getComponent(block.type);
        if (!comp) {
            container.innerHTML = '<p class="empty-hint">未知组件类型</p>';
            return;
        }

        let html = `<h4 style="margin-bottom:8px;color:#374151;">${comp.icon} ${comp.label} 属性</h4>`;

        comp.fields.forEach(field => {
            if (field.type === 'group') {
                html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600;">${field.label}</div>
                    <div class="form-row">`;
                field.fields.forEach(subField => {
                    html += renderFormField(subField, block.data[subField.key]);
                });
                html += `</div></div>`;
            } else {
                html += renderFormField(field, block.data[field.key]);
            }
        });

        container.innerHTML = html;

        bindFieldEvents(container, block);
    }

    function renderColumnProperties(block, colIdx) {
        const container = document.getElementById('properties-content');
        const child = block.data.children[colIdx];
        if (!child) return;

        const comp = ComponentLibrary.getComponent(child.type);
        if (!comp) return;

        let html = `<h4 style="margin-bottom:8px;color:#374151;">📊 第${colIdx + 1}栏 - ${comp.label} 属性</h4>`;

        comp.fields.forEach(field => {
            if (field.type === 'group') {
                html += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e5e7eb;">
                    <div style="font-size:12px;color:#6b7280;margin-bottom:6px;font-weight:600;">${field.label}</div>
                    <div class="form-row">`;
                field.fields.forEach(subField => {
                    html += renderFormField(subField, child.data[subField.key], `col-${colIdx}-`);
                });
                html += `</div></div>`;
            } else {
                html += renderFormField(field, child.data[field.key], `col-${colIdx}-`);
            }
        });

        container.innerHTML = html;

        bindColumnFieldEvents(container, block.id, colIdx);
    }

    function renderFormField(field, value, prefix = '') {
        const inputId = prefix + 'field-' + field.key;
        switch (field.type) {
            case 'text':
            case 'number':
                const step = field.step ? ` step="${field.step}"` : '';
                return `<div class="form-group">
                    <label for="${inputId}">${field.label}</label>
                    <input type="${field.type}" id="${inputId}" data-field="${field.key}" value="${value !== undefined ? value : ''}"${step}>
                </div>`;
            case 'textarea':
                return `<div class="form-group">
                    <label for="${inputId}">${field.label}</label>
                    <textarea id="${inputId}" data-field="${field.key}">${value !== undefined ? value : ''}</textarea>
                </div>`;
            case 'select':
                const options = field.options.map(opt => 
                    `<option value="${opt.value}" ${value == opt.value ? 'selected' : ''}>${opt.label}</option>`
                ).join('');
                return `<div class="form-group">
                    <label for="${inputId}">${field.label}</label>
                    <select id="${inputId}" data-field="${field.key}">${options}</select>
                </div>`;
            case 'color':
                return `<div class="form-group">
                    <label for="${inputId}">${field.label}</label>
                    <input type="color" id="${inputId}" data-field="${field.key}" value="${value || '#000000'}">
                </div>`;
            default:
                return '';
        }
    }

    function bindFieldEvents(container, block) {
        container.querySelectorAll('[data-field]').forEach(input => {
            const field = input.dataset.field;
            const eventType = input.type === 'color' || input.tagName === 'SELECT' ? 'input' : 'input';

            input.addEventListener(eventType, (e) => {
                let value = e.target.value;
                if (input.type === 'number') {
                    value = parseFloat(value) || 0;
                }
                LayoutManager.updateBlock(block.id, { [field]: value });
            });

            if (input.tagName === 'SELECT') {
                input.addEventListener('change', (e) => {
                    let value = e.target.value;
                    if (!isNaN(parseFloat(value)) && isFinite(value)) {
                        value = parseFloat(value);
                    }
                    if (field === 'columns') {
                        handleColumnCountChange(block.id, value);
                    } else {
                        LayoutManager.updateBlock(block.id, { [field]: value });
                    }
                });
            }
        });
    }

    function handleColumnCountChange(blockId, newCount) {
        const block = LayoutManager.getState().blocks.find(b => b.id === blockId);
        if (!block || block.type !== 'columns') return;

        const newChildren = [...(block.data.children || [])];
        const targetCount = parseInt(newCount);

        while (newChildren.length < targetCount) {
            newChildren.push({
                type: 'paragraph',
                data: JSON.parse(JSON.stringify(ComponentLibrary.getComponent('paragraph').defaults))
            });
        }
        while (newChildren.length > targetCount) {
            newChildren.pop();
        }

        LayoutManager.updateBlock(blockId, { columns: targetCount, children: newChildren });
    }

    function bindColumnFieldEvents(container, blockId, colIdx) {
        container.querySelectorAll('[data-field]').forEach(input => {
            const field = input.dataset.field;

            input.addEventListener('input', (e) => {
                let value = e.target.value;
                if (input.type === 'number') {
                    value = parseFloat(value) || 0;
                }
                LayoutManager.updateColumnChild(blockId, colIdx, { [field]: value });
            });

            if (input.tagName === 'SELECT') {
                input.addEventListener('change', (e) => {
                    let value = e.target.value;
                    if (!isNaN(parseFloat(value)) && isFinite(value)) {
                        value = parseFloat(value);
                    }
                    LayoutManager.updateColumnChild(blockId, colIdx, { [field]: value });
                });
            }
        });
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
