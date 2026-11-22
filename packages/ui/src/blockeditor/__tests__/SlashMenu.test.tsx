import {describe, it, expect, afterEach} from 'vitest';
import {render, screen, cleanup, act, fireEvent} from '@testing-library/react';
import {renderHook} from '@testing-library/react';
import {createDoc, rootBlocks} from '../model';
import {useBlockEditor} from '../useBlockEditor';
import {registerReactiveBlocks} from '../reactiveBlocks';
import {registerFormBlock} from '../FormBlockView';
import {SlashMenu} from '../SlashMenu';
import {BlockEditor} from '../BlockEditor';
import {I18nProvider} from '@/providers';

afterEach(() => cleanup());

function renderMenu(pageId?: string, onLink?: () => void) {
  registerReactiveBlocks(); // gives the menu an "interactive" item (the slider)
  registerFormBlock();
  const doc = createDoc([{id: 'x', type: 'paragraph'}]);
  const {result} = renderHook(() => useBlockEditor(doc));
  return render(
    <SlashMenu
      state={{open: true, blockId: 'x', anchorOffset: 0, query: '', index: 0}}
      editor={result.current}
      anchorEl={null}
      rootEl={null}
      onClose={() => {}}
      pageId={pageId}
      onLink={onLink}
    />,
  );
}

describe('SlashMenu grouping', () => {
  it('renders category headers and the new page/database commands', () => {
    renderMenu('parent-page');
    expect(screen.getByText('Pages')).toBeTruthy();
    expect(screen.getByText('Basic blocks')).toBeTruthy();
    expect(screen.getByText('Interactive blocks')).toBeTruthy();
    expect(screen.getByText('Form')).toBeTruthy();
    // #5: the page/database insert commands.
    expect(screen.getByText('New page')).toBeTruthy();
    expect(screen.getByText('New database')).toBeTruthy();
    // A basic block is still present.
    expect(screen.getByText('Text')).toBeTruthy();
  });

  it('omits the Pages group when there is no host page and no link handler', () => {
    renderMenu(undefined);
    expect(screen.queryByText('Pages')).toBeNull();
    expect(screen.queryByText('New page')).toBeNull();
    expect(screen.getByText('Basic blocks')).toBeTruthy();
  });

  it('offers the link-to-existing commands when a link handler is provided', () => {
    renderMenu(undefined, () => {});
    expect(screen.getByText('Pages')).toBeTruthy();
    expect(screen.getByText('Link to page')).toBeTruthy();
    expect(screen.getByText('Link to database')).toBeTruthy();
  });

  it('renders an icon for each command (#3)', () => {
    const {container} = renderMenu('parent-page');
    const item = container.querySelector('.obe-slash-item');
    expect(item?.querySelector('svg.obe-slash-icon')).toBeTruthy();
    expect(screen.getByText('Canvas').closest('.obe-slash-item')?.querySelector('svg.lucide-pen-tool')).toBeTruthy();
  });
});

// Exercise the production contenteditable → SlashMenu → pendingCaret consumers.
// Native browser traces separately assert the painted focus ring.
it.each(['canvas','slider'])('slash insertion focuses the opted region or non-opted paragraph: %s',type=>{
  registerReactiveBlocks();
  const doc=createDoc([{id:'entry',type:'paragraph'}]);
  const {container}=render(<I18nProvider><BlockEditor doc={doc}/></I18nProvider>);
  const text=container.querySelector<HTMLElement>('[data-block-text="entry"]')!;
  act(()=>text.focus());
  for(const ch of `/${type}`)act(()=>{text.dispatchEvent(new InputEvent('beforeinput',{inputType:'insertText',data:ch,bubbles:true,cancelable:true}));});
  const item=screen.getByText(type==='canvas'?'Canvas':'Slider').closest('.obe-slash-item')!;
  fireEvent.mouseDown(item);
  if(type==='canvas'){
    expect(document.activeElement).toBe(screen.getByRole('region',{name:/Canvas/}));
    expect(screen.getByRole('button',{name:'Pen (P)'}).getAttribute('aria-pressed')).toBe('true');
  }else{
    expect(document.activeElement?.hasAttribute('data-block-text')).toBe(true);
    expect(document.activeElement?.getAttribute('data-block-text')).not.toBe('entry');
    const blocks=rootBlocks(doc).toArray();const slider=blocks.findIndex(block=>block.get('type')==='slider');expect(slider).toBeGreaterThanOrEqual(0);expect(document.activeElement?.getAttribute('data-block-text')).toBe(blocks[slider+1].get('id'));
  }
});
