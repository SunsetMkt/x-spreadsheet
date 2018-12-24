/* global window */
import { h } from './element';
import { bind, mouseMoveUp } from '../event';
import Resizer from './resizer';
import Scrollbar from './scrollbar';
import Selector from './selector';
import Table from './table';
import { formulas as _formulas } from '../formula';

function scrollbarMove() {
  const { table, verticalScrollbar, horizontalScrollbar } = this;
  const {
    l, t, left, top, width, height,
  } = table.getSelectRect();
  const tableOffset = this.getTableOffset();
  // console.log(',l:', l, ', left:', left, ', tOffset.left:', tableOffset.width);
  if (Math.abs(left) + width > tableOffset.width) {
    horizontalScrollbar.move({ left: l + width - tableOffset.width });
  } else {
    const fsw = table.freezeSumWidth();
    if (left < fsw) {
      horizontalScrollbar.move({ left: l - 1 - fsw });
    }
  }
  // console.log('top:', top, ', height:', height, ', tof.height:', tableOffset.height);
  if (Math.abs(top) + height > tableOffset.height) {
    verticalScrollbar.move({ top: t + height - tableOffset.height - 1 });
  } else {
    const fsh = table.freezeSumHeight();
    if (top < fsh) {
      verticalScrollbar.move({ top: t - 1 - fsh });
    }
  }
}

function selectorSet(multiple, ri, ci) {
  const {
    table, selector,
  } = this;
  if (multiple) {
    selector.setEnd([ri, ci], (sIndexes, eIndexes) => {
      // console.log('sIndexes:', sIndexes, ', eIndexes:', eIndexes, table.scrollOffset);
      table.setSelectRectIndexes([sIndexes, eIndexes]).render();
      // console.log('table.getSelectRect():', table.getSelectRect());
      return table.getSelectRect();
    });
  } else {
    // console.log('ri:', ri, ', ci:', ci);
    table.setSelectRectIndexes([[ri, ci], [ri, ci]]).render();
    // console.log('table.getSelectRect():', table.getSelectRect());
    const selectRect = table.getSelectRect();
    selector.set([ri, ci], selectRect);
  }
}

function selectorSetByEvent(multiple, evt) {
  const { table } = this;
  const {
    ri, ci, // left, top, width, height,
  } = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY);
  // console.log('::::overlayerMousemove.ri, ci:', ri, ci);
  if (ri === 0 && ci === 0) return;
  selectorSet.call(this, multiple, ri, ci);
}

// multiple: boolean
// direction: left | right | up | down
function selectorMove(multiple, direction) {
  const {
    selector, col, row,
  } = this;
  let [ri, ci] = selector.indexes;
  if (multiple) {
    [ri, ci] = selector.moveIndexes;
  }
  if (direction === 'left') {
    if (ci > 1) ci -= 1;
  } else if (direction === 'right') {
    if (ci < col.len) ci += 1;
  } else if (direction === 'up') {
    if (ri > 1) ri -= 1;
  } else if (direction === 'down') {
    if (ri < row.len) ri += 1;
  }
  if (multiple) {
    selector.moveIndexes = [ri, ci];
  }
  selectorSet.call(this, multiple, ri, ci);
  scrollbarMove.call(this);
}

// private methods
function overlayerMousemove(evt) {
  // console.log('evt.buttons: ', evt.buttons, evt);
  if (evt.buttons !== 0) return;
  if (evt.target.className === 'xss-resizer-hover') return;
  const {
    table, rowResizer, colResizer, tableEl,
  } = this;
  const tRect = tableEl.box();
  const cRect = table.getCellRectWithIndexes(evt.offsetX, evt.offsetY, false);
  if (cRect.ri >= 1 && cRect.ci === 0) {
    rowResizer.show(cRect, {
      width: tRect.width,
    });
  } else {
    rowResizer.hide();
  }
  if (cRect.ri === 0 && cRect.ci >= 1) {
    colResizer.show(cRect, {
      height: tRect.height,
    });
  } else {
    colResizer.hide();
  }
}

function overlayerMousedown(evt) {
  // console.log(':::::overlayer.mousedown:', evt.detail, evt.button, evt.buttons, evt.shiftKey);
  if (!evt.shiftKey) {
    // console.log('selectorSetStart:::');
    selectorSetByEvent.call(this, false, evt);

    // mouse move up
    mouseMoveUp(window, (e) => {
      // console.log('mouseMoveUp::::');
      if (e.buttons === 1 && !e.shiftKey) {
        selectorSetByEvent.call(this, true, e);
      }
    }, () => {
    });
  }

  if (evt.buttons === 1) {
    if (evt.shiftKey) {
      // to-do
      // console.log('shiftKey::::');
      selectorSetByEvent.call(this, true, evt);
    }
  }
}

function verticalScrollbarSet() {
  const { table, verticalScrollbar } = this;
  const { height } = this.getTableOffset();
  verticalScrollbar.set(height, table.rowTotalHeight());
}

function horizontalScrollbarSet() {
  const { table, horizontalScrollbar } = this;
  const { width } = this.getTableOffset();
  horizontalScrollbar.set(width, table.colTotalWidth());
}

function verticalScrollbarMove(distance) {
  const { table, selector } = this;
  table.scroll({ y: distance }, (d) => {
    selector.addTop(-d);
  });
}

function horizontalScrollbarMove(distance) {
  const { table, selector } = this;
  table.scroll({ x: distance }, (d) => {
    selector.addLeft(-d);
  });
}

function rowResizerFinished(cRect, distance) {
  const { ri, height } = cRect;
  const { table, selector } = this;
  table.setRowHeight(ri - 1, distance);
  selector.addTopOrHeight(ri, distance - height);
  selector.setFreezeLengths(selector.freezeWidth, table.freezeSumHeight());
  verticalScrollbarSet.call(this);
}

function colResizerFinished(cRect, distance) {
  const { ci, width } = cRect;
  const { table, selector } = this;
  table.setColWidth(ci - 1, distance);
  selector.addLeftOrWidth(ci, distance - width);
  selector.setFreezeLengths(table.freezeSumWidth(), selector.freezeHeight);
  horizontalScrollbarSet.call(this);
}

function sheetReset() {
  const {
    tableEl, overlayerEl, overlayerCEl,
  } = this;
  const tOffset = this.getTableOffset();
  const vRect = this.getRect();
  tableEl.attr(vRect);
  overlayerEl.offset(vRect);
  overlayerCEl.offset(tOffset);
  verticalScrollbarSet.call(this);
  horizontalScrollbarSet.call(this);
}

function sheetInitEvents() {
  const {
    overlayerEl, rowResizer, colResizer, verticalScrollbar, horizontalScrollbar,
  } = this;
  // overlayer
  overlayerEl
    .on('mousemove', (evt) => {
      overlayerMousemove.call(this, evt);
    })
    .on('mousedown', (evt) => {
      overlayerMousedown.call(this, evt);
    });
  // resizer finished callback
  rowResizer.finishedFn = (cRect, distance) => {
    rowResizerFinished.call(this, cRect, distance);
  };
  colResizer.finishedFn = (cRect, distance) => {
    colResizerFinished.call(this, cRect, distance);
  };
  // scrollbar move callback
  verticalScrollbar.moveFn = (distance, evt) => {
    verticalScrollbarMove.call(this, distance, evt);
  };
  horizontalScrollbar.moveFn = (distance, evt) => {
    horizontalScrollbarMove.call(this, distance, evt);
  };

  bind(window, 'resize', () => {
    this.reload();
  });

  bind(window, 'click', (evt) => {
    this.focusing = overlayerEl.contains(evt.target);
  });

  bind(window, 'mousewheel', (evt) => {
    if (!this.focusing) return;
    const { table, row } = this;
    const { top } = this.verticalScrollbar.scroll();
    if (evt.deltaY > 0) {
      // up
      const ri = table.scrollIndexes[0] + 1;
      if (ri < row.len) {
        this.verticalScrollbar.move({ top: top + table.getRowHeight(ri) });
      }
    } else {
      // down
      const ri = table.scrollIndexes[0] - 1;
      if (ri >= 0) {
        this.verticalScrollbar.move({ top: ri === 0 ? 0 : top - table.getRowHeight(ri) });
      }
    }
  });

  // for selector
  bind(window, 'keydown', (evt) => {
    if (!this.focusing) return;
    // console.log('keydown.evt: ', evt);
    if (evt.ctrlKey) {
      switch (evt.keyCode) {
        case 67:
          // ctrl + c
          evt.preventDefault();
          break;
        case 88:
          // ctrl + x
          evt.preventDefault();
          break;
        case 86:
          // ctrl + v
          evt.preventDefault();
          break;
        default:
          break;
      }
      // return;
    } else {
      switch (evt.keyCode) {
        case 37: // left
          selectorMove.call(this, evt.shiftKey, 'left');
          evt.preventDefault();
          break;
        case 38: // up
          selectorMove.call(this, evt.shiftKey, 'up');
          evt.preventDefault();
          break;
        case 39: // right
          selectorMove.call(this, evt.shiftKey, 'right');
          evt.preventDefault();
          break;
        case 40: // down
          selectorMove.call(this, evt.shiftKey, 'down');
          evt.preventDefault();
          break;
        case 9: // tab
          selectorMove.call(this, evt.shiftKey, 'right');
          evt.preventDefault();
          break;
        case 13: // enter
          selectorMove.call(this, evt.shiftKey, 'down');
          evt.preventDefault();
          break;
        default:
          break;
      }
    }
  });
}

function sheetFreeze() {
  const {
    table, selector,
  } = this;
  const [ri, ci] = table.freezeIndexes;
  if (ri > 1 || ci > 1) {
    selector.setFreezeLengths(table.freezeSumWidth(), table.freezeSumHeight());
  } else {
    selector.setFreezeLengths(0, 0);
  }
}

export default class Sheet {
  constructor(targetEl, options = {}) {
    this.el = h('div', 'xss-sheet');
    targetEl.appendChild(this.el.el);
    // console.log('elRect:', elRect);
    const {
      row, col, style, formulas, view,
    } = options;
    this.view = view;
    this.col = col;
    this.row = row;
    // table
    this.tableEl = h('canvas', 'xss-table');
    this.table = new Table(this.tableEl.el, row, col, style, _formulas(formulas));
    // resizer
    this.rowResizer = new Resizer(false, row.height);
    this.colResizer = new Resizer(true, col.minWidth);
    // scrollbar
    this.verticalScrollbar = new Scrollbar(true);
    this.horizontalScrollbar = new Scrollbar(false);
    // selector
    this.selector = new Selector();
    this.overlayerCEl = h('div', 'xss-overlayer-content')
      .children(...this.selector.elements());
    this.overlayerEl = h('div', 'xss-overlayer')
      .child(this.overlayerCEl);
    // root element
    this.el.children(
      this.tableEl,
      this.overlayerEl.el,
      this.rowResizer.el,
      this.colResizer.el,
      this.verticalScrollbar.el,
      this.horizontalScrollbar.el,
    );
    sheetInitEvents.call(this);
    sheetReset.call(this);
  }

  loadData(data) {
    const { table } = this;
    table.setData(data);
    table.render();
    sheetFreeze.call(this);
    return this;
  }

  // freeze rows or cols
  freeze(ri, ci) {
    const { table } = this;
    table.setFreezeIndexes([ri, ci]);
    table.render();
    sheetFreeze.call(this);
    return this;
  }

  reload() {
    sheetReset.call(this);
    this.table.render();
    return this;
  }

  getRect() {
    const { width } = this.el.box();
    const height = this.view.height();
    return { width, height };
  }

  getTableOffset() {
    const { row, col } = this;
    const { width, height } = this.getRect();
    return {
      width: width - col.indexWidth,
      height: height - row.height,
      left: col.indexWidth,
      top: row.height,
    };
  }
}