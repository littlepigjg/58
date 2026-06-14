const LayoutManager = (() => {

    let state = null;
    let onChangeCallback = null;
    let onSelectCallback = null;

    function init(initialState, callbacks) {
        state = initialState;
        onChangeCallback = callbacks.onChange || (() => {});
        onSelectCallback = callbacks.onSelect || (() => {});
    }

    function getState() {
        return state;
    }

    function setState(newState) {
        state = newState;
        onChangeCallback(state);
    }

    function addBlock(block, targetIndex = null) {
        const newBlocks = [...state.blocks];
        if (targetIndex === null || targetIndex >= newBlocks.length) {
            newBlocks.push(block);
        } else {
            newBlocks.splice(targetIndex, 0, block);
        }
        setState({ ...state, blocks: newBlocks });
    }

    function removeBlock(blockId) {
        const newBlocks = state.blocks.filter(b => b.id !== blockId);
        setState({ ...state, blocks: newBlocks });
        if (state.selectedId === blockId) {
            selectBlock(null);
        }
    }

    function moveBlock(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        const newBlocks = [...state.blocks];
        const [removed] = newBlocks.splice(fromIndex, 1);
        newBlocks.splice(toIndex > fromIndex ? toIndex - 1 : toIndex, 0, removed);
        setState({ ...state, blocks: newBlocks });
    }

    function updateBlock(blockId, data) {
        const newBlocks = state.blocks.map(b => {
            if (b.id === blockId) {
                return { ...b, data: { ...b.data, ...data } };
            }
            return b;
        });
        setState({ ...state, blocks: newBlocks });
    }

    function selectBlock(blockId) {
        state.selectedId = blockId;
        onSelectCallback(blockId);
    }

    function getSelectedBlock() {
        if (!state.selectedId) return null;
        return state.blocks.find(b => b.id === state.selectedId) || null;
    }

    function getBlockIndex(blockId) {
        return state.blocks.findIndex(b => b.id === blockId);
    }

    function duplicateBlock(blockId) {
        const index = getBlockIndex(blockId);
        if (index === -1) return;
        const original = state.blocks[index];
        const copy = JSON.parse(JSON.stringify(original));
        copy.id = 'block_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        if (copy.data.children) {
            copy.data.children = copy.data.children.map(c => ({
                ...c,
                id: 'colitem_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
            }));
        }
        addBlock(copy, index + 1);
    }

    function updateColumnChild(blockId, colIndex, data) {
        const newBlocks = state.blocks.map(b => {
            if (b.id === blockId && b.data.children && b.data.children[colIndex]) {
                const newChildren = [...b.data.children];
                newChildren[colIndex] = {
                    ...newChildren[colIndex],
                    data: { ...newChildren[colIndex].data, ...data }
                };
                return { ...b, data: { ...b.data, children: newChildren } };
            }
            return b;
        });
        setState({ ...state, blocks: newBlocks });
    }

    function clearAll() {
        setState({ ...state, blocks: [], selectedId: null });
        selectBlock(null);
    }

    return {
        init,
        getState,
        setState,
        addBlock,
        removeBlock,
        moveBlock,
        updateBlock,
        selectBlock,
        getSelectedBlock,
        getBlockIndex,
        duplicateBlock,
        updateColumnChild,
        clearAll
    };
})();
